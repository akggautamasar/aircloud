
import asyncio
import logging
from typing import Optional
from pyrogram import Client, filters
from pyrogram.types import Message
import tempfile
import os

from .clients import TelegramManager
from .directoryHandler import DatabaseManager
from .uploader import TelegramUploader
from config import get_settings

logger = logging.getLogger(__name__)

class BotModeHandler:
    def __init__(self, telegram_manager: TelegramManager, db_manager: DatabaseManager):
        self.telegram_manager = telegram_manager
        self.db_manager = db_manager
        self.settings = get_settings()
        self.bot_client: Optional[Client] = None
        self.uploader = TelegramUploader(telegram_manager, db_manager)
        
    async def start_bot(self):
        """Start bot mode for file uploads"""
        if not self.settings.MAIN_BOT_TOKEN:
            return
            
        try:
            self.bot_client = Client(
                "main_bot",
                api_id=self.settings.API_ID,
                api_hash=self.settings.API_HASH,
                bot_token=self.settings.MAIN_BOT_TOKEN,
                workdir="sessions"
            )
            
            # Register handlers
            self.bot_client.add_handler(
                MessageHandler(self.handle_file_upload, 
                filters.document | filters.video | filters.photo | filters.audio)
            )
            
            self.bot_client.add_handler(
                MessageHandler(self.handle_commands, filters.command)
            )
            
            await self.bot_client.start()
            logger.info("Bot mode started successfully")
            
        except Exception as e:
            logger.error(f"Bot mode start error: {e}")
            
    async def handle_file_upload(self, client: Client, message: Message):
        """Handle file uploads via bot"""
        try:
            # Check if user is admin
            if message.from_user.id not in self.settings.admin_ids:
                await message.reply("❌ Unauthorized access")
                return
                
            # Get file info
            file_ref = None
            filename = "unknown"
            file_size = 0
            
            if message.document:
                file_ref = message.document
                filename = file_ref.file_name or f"document_{file_ref.file_id}"
                file_size = file_ref.file_size
            elif message.video:
                file_ref = message.video
                filename = f"video_{file_ref.file_id}.mp4"
                file_size = file_ref.file_size
            elif message.photo:
                file_ref = message.photo
                filename = f"photo_{file_ref.file_id}.jpg"
                file_size = file_ref.file_size
            elif message.audio:
                file_ref = message.audio
                filename = file_ref.file_name or f"audio_{file_ref.file_id}.mp3"
                file_size = file_ref.file_size
                
            if not file_ref:
                await message.reply("❌ No file found")
                return
                
            # Download file
            await message.reply("📥 Downloading file...")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
                await message.download(tmp.name)
                tmp_path = tmp.name
                
            # Upload to storage
            await message.reply("📤 Uploading to storage...")
            
            result = await self.uploader.upload_file(
                tmp_path,
                filename,
                str(message.from_user.id),
                file_size
            )
            
            if result.get("success"):
                await message.reply(f"✅ File uploaded successfully!\n📁 {filename}")
            else:
                await message.reply("❌ Upload failed")
                
        except Exception as e:
            logger.error(f"Bot upload error: {e}")
            await message.reply(f"❌ Error: {str(e)}")
            
    async def handle_commands(self, client: Client, message: Message):
        """Handle bot commands"""
        try:
            command = message.command[0].lower()
            
            if command == "start":
                await message.reply(
                    "🤖 **Telegram File Manager Bot**\n\n"
                    "Send me any file and I'll upload it to your storage!\n\n"
                    "Commands:\n"
                    "/stats - View storage statistics\n"
                    "/help - Show this message"
                )
                
            elif command == "stats":
                if message.from_user.id not in self.settings.admin_ids:
                    await message.reply("❌ Unauthorized")
                    return
                    
                stats = await self.db_manager.get_stats()
                await message.reply(
                    f"📊 **Storage Statistics**\n\n"
                    f"📁 Total Files: {stats['total_files']}\n"
                    f"💾 Total Size: {stats['total_size_mb']} MB\n"
                    f"🕒 Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                )
                
            elif command == "help":
                await message.reply(
                    "ℹ️ **Help**\n\n"
                    "Simply send any file (document, video, photo, audio) "
                    "and I'll upload it to your Telegram storage.\n\n"
                    "Supported formats: All file types up to 2GB (4GB for premium)"
                )
                
        except Exception as e:
            logger.error(f"Command error: {e}")
            await message.reply("❌ Command failed")

from pyrogram.handlers import MessageHandler
