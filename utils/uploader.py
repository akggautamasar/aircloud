
import asyncio
import os
import time
import logging
from typing import Dict, Optional, Callable
from pyrogram import Client
from pyrogram.types import Message
from PIL import Image
import magic

from .clients import TelegramManager
from .directoryHandler import DatabaseManager
from .file_properties import get_video_duration, get_audio_duration

logger = logging.getLogger(__name__)

class TelegramUploader:
    def __init__(self, telegram_manager: TelegramManager, db_manager: DatabaseManager):
        self.telegram_manager = telegram_manager
        self.db_manager = db_manager
        self.progress_data: Dict[str, dict] = {}
        
    async def upload_file(
        self, 
        file_path: str, 
        filename: str, 
        user_id: str,
        file_size: int,
        progress_callback: Optional[Callable] = None
    ) -> dict:
        """Upload file to Telegram and save to database"""
        task_id = f"{user_id}_{int(time.time())}"
        
        try:
            self.progress_data[task_id] = {
                "status": "starting",
                "progress": 0,
                "filename": filename,
                "file_size": file_size
            }
            
            client = await self.telegram_manager.get_client(prefer_user=True)
            
            # Determine file type and prepare metadata
            mime_type = magic.from_file(file_path, mime=True)
            file_info = await self._prepare_file_metadata(file_path, filename, mime_type)
            
            self.progress_data[task_id]["status"] = "uploading"
            
            # Upload based on file type
            message = await self._upload_by_type(
                client, 
                file_path, 
                file_info,
                lambda current, total: self._update_progress(task_id, current, total)
            )
            
            # Save to database
            file_record = {
                "user_id": user_id,
                "file_name": filename,
                "file_size": file_size,
                "file_type": mime_type,
                "telegram_file_id": self._get_file_id(message),
                "telegram_message_id": message.id,
                "channel_id": str(self.telegram_manager.settings.STORAGE_CHANNEL)
            }
            
            await self.db_manager.save_file(file_record)
            
            self.progress_data[task_id] = {
                "status": "completed",
                "progress": 100,
                "filename": filename,
                "message_id": message.id
            }
            
            # Cleanup
            if os.path.exists(file_path):
                os.unlink(file_path)
                
            await self.telegram_manager.release_client(client)
            
            return {
                "success": True,
                "message_id": message.id,
                "file_id": self._get_file_id(message)
            }
            
        except Exception as e:
            logger.error(f"Upload error: {e}")
            self.progress_data[task_id] = {
                "status": "failed",
                "progress": 0,
                "error": str(e)
            }
            
            if os.path.exists(file_path):
                os.unlink(file_path)
                
            raise e
            
    async def _prepare_file_metadata(self, file_path: str, filename: str, mime_type: str) -> dict:
        """Prepare file metadata for upload"""
        file_info = {
            "filename": filename,
            "mime_type": mime_type,
            "supports_streaming": False
        }
        
        if mime_type.startswith("image/"):
            try:
                with Image.open(file_path) as img:
                    file_info["width"] = img.width
                    file_info["height"] = img.height
            except Exception:
                pass
                
        elif mime_type.startswith("video/"):
            file_info["supports_streaming"] = True
            file_info["duration"] = await get_video_duration(file_path)
            
        elif mime_type.startswith("audio/"):
            file_info["duration"] = await get_audio_duration(file_path)
            
        return file_info
        
    async def _upload_by_type(self, client: Client, file_path: str, file_info: dict, progress_callback) -> Message:
        """Upload file based on its type"""
        channel_id = self.telegram_manager.settings.STORAGE_CHANNEL
        
        if file_info["mime_type"].startswith("image/"):
            return await client.send_photo(
                channel_id,
                file_path,
                caption=file_info["filename"],
                progress=progress_callback
            )
            
        elif file_info["mime_type"].startswith("video/"):
            return await client.send_video(
                channel_id,
                file_path,
                caption=file_info["filename"],
                duration=file_info.get("duration", 0),
                supports_streaming=file_info.get("supports_streaming", False),
                progress=progress_callback
            )
            
        elif file_info["mime_type"].startswith("audio/"):
            return await client.send_audio(
                channel_id,
                file_path,
                caption=file_info["filename"],
                duration=file_info.get("duration", 0),
                progress=progress_callback
            )
            
        else:
            return await client.send_document(
                channel_id,
                file_path,
                caption=file_info["filename"],
                progress=progress_callback
            )
            
    def _get_file_id(self, message: Message) -> str:
        """Extract file ID from message"""
        if message.document:
            return message.document.file_id
        elif message.video:
            return message.video.file_id
        elif message.photo:
            return message.photo.file_id
        elif message.audio:
            return message.audio.file_id
        return ""
        
    def _update_progress(self, task_id: str, current: int, total: int):
        """Update upload progress"""
        if task_id in self.progress_data:
            progress = (current / total) * 100 if total > 0 else 0
            self.progress_data[task_id]["progress"] = progress
            
    async def get_progress(self, task_id: str) -> dict:
        """Get upload progress"""
        return self.progress_data.get(task_id, {"status": "not_found", "progress": 0})
