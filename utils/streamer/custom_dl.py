
import asyncio
import logging
from typing import Optional, Tuple
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pyrogram import Client
from pyrogram.errors import FloodWait
import io

from ..clients import TelegramManager

logger = logging.getLogger(__name__)

class ByteStreamer:
    def __init__(self, telegram_manager: TelegramManager):
        self.telegram_manager = telegram_manager
        self.chunk_size = 1024 * 1024  # 1MB chunks
        
    async def stream_full(self, file_id: str, file_info: dict) -> StreamingResponse:
        """Stream full file"""
        try:
            client = await self.telegram_manager.get_client()
            
            async def generate():
                try:
                    async for chunk in client.stream_media(file_id, limit=self.chunk_size):
                        yield chunk
                except FloodWait as e:
                    await asyncio.sleep(e.value)
                    async for chunk in client.stream_media(file_id, limit=self.chunk_size):
                        yield chunk
                finally:
                    await self.telegram_manager.release_client(client)
            
            headers = {
                "Content-Type": file_info.get("file_type", "application/octet-stream"),
                "Content-Length": str(file_info.get("file_size", 0)),
                "Accept-Ranges": "bytes"
            }
            
            return StreamingResponse(
                generate(),
                status_code=200,
                headers=headers,
                media_type=file_info.get("file_type", "application/octet-stream")
            )
            
        except Exception as e:
            logger.error(f"Full streaming error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
    async def stream_partial(
        self, 
        file_id: str, 
        range_start: int, 
        range_end: int, 
        file_info: dict
    ) -> StreamingResponse:
        """Stream partial file content (range request)"""
        try:
            client = await self.telegram_manager.get_client()
            file_size = file_info.get("file_size", 0)
            
            # Validate range
            if range_start >= file_size:
                raise HTTPException(status_code=416, detail="Range not satisfiable")
            
            range_end = min(range_end, file_size - 1)
            content_length = range_end - range_start + 1
            
            async def generate():
                try:
                    current_pos = 0
                    async for chunk in client.stream_media(file_id, limit=self.chunk_size):
                        chunk_start = current_pos
                        chunk_end = current_pos + len(chunk) - 1
                        
                        # Skip chunks before range
                        if chunk_end < range_start:
                            current_pos += len(chunk)
                            continue
                            
                        # Stop if we've passed the range
                        if chunk_start > range_end:
                            break
                            
                        # Trim chunk to fit range
                        start_offset = max(0, range_start - chunk_start)
                        end_offset = min(len(chunk), range_end - chunk_start + 1)
                        
                        yield chunk[start_offset:end_offset]
                        current_pos += len(chunk)
                        
                except FloodWait as e:
                    await asyncio.sleep(e.value)
                finally:
                    await self.telegram_manager.release_client(client)
            
            headers = {
                "Content-Type": file_info.get("file_type", "application/octet-stream"),
                "Content-Length": str(content_length),
                "Content-Range": f"bytes {range_start}-{range_end}/{file_size}",
                "Accept-Ranges": "bytes"
            }
            
            return StreamingResponse(
                generate(),
                status_code=206,
                headers=headers,
                media_type=file_info.get("file_type", "application/octet-stream")
            )
            
        except Exception as e:
            logger.error(f"Partial streaming error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
    async def stream_download(self, file_id: str, file_info: dict) -> StreamingResponse:
        """Stream file as download attachment"""
        response = await self.stream_full(file_id, file_info)
        response.headers["Content-Disposition"] = f'attachment; filename="{file_info.get("file_name", "download")}"'
        return response
        
    def parse_range_header(self, range_header: str, file_size: int) -> Tuple[int, int]:
        """Parse HTTP Range header"""
        try:
            # Range header format: "bytes=start-end"
            range_part = range_header.replace("bytes=", "")
            
            if "-" not in range_part:
                raise ValueError("Invalid range format")
                
            start_str, end_str = range_part.split("-", 1)
            
            # Handle different range formats
            if start_str and end_str:
                # bytes=0-1023
                start = int(start_str)
                end = int(end_str)
            elif start_str and not end_str:
                # bytes=1024-
                start = int(start_str)
                end = file_size - 1
            elif not start_str and end_str:
                # bytes=-1024 (last 1024 bytes)
                end = file_size - 1
                start = max(0, file_size - int(end_str))
            else:
                raise ValueError("Invalid range format")
                
            # Validate range
            start = max(0, start)
            end = min(end, file_size - 1)
            
            if start > end:
                raise ValueError("Invalid range: start > end")
                
            return start, end
            
        except Exception as e:
            logger.error(f"Range parsing error: {e}")
            return 0, file_size - 1
