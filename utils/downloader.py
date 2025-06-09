
import asyncio
import aiohttp
import tempfile
import logging
from typing import Optional
from urllib.parse import urlparse
import os

from .clients import TelegramManager
from .directoryHandler import DatabaseManager
from .uploader import TelegramUploader

logger = logging.getLogger(__name__)

class URLDownloader:
    def __init__(self, telegram_manager: TelegramManager, db_manager: DatabaseManager):
        self.telegram_manager = telegram_manager
        self.db_manager = db_manager
        self.uploader = TelegramUploader(telegram_manager, db_manager)
        
    async def download_and_upload(self, url: str, filename: Optional[str], user_id: str) -> dict:
        """Download file from URL and upload to Telegram"""
        try:
            # Download file
            file_path, actual_filename, file_size = await self._download_file(url, filename)
            
            # Upload to Telegram
            result = await self.uploader.upload_file(
                file_path,
                actual_filename,
                user_id,
                file_size
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Download and upload error: {e}")
            raise e
            
    async def _download_file(self, url: str, filename: Optional[str]) -> tuple:
        """Download file from URL"""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"Failed to download: HTTP {response.status}")
                
                # Determine filename
                if not filename:
                    filename = self._extract_filename(url, response.headers)
                
                # Get file size
                file_size = int(response.headers.get('content-length', 0))
                
                # Check size limits
                max_size = self.telegram_manager.settings.MAX_FILE_SIZE
                if file_size > max_size:
                    raise Exception(f"File too large: {file_size} > {max_size}")
                
                # Download to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
                    async for chunk in response.content.iter_chunked(8192):
                        tmp.write(chunk)
                    
                    return tmp.name, filename, file_size
                    
    def _extract_filename(self, url: str, headers: dict) -> str:
        """Extract filename from URL or headers"""
        # Try Content-Disposition header
        cd = headers.get('content-disposition', '')
        if 'filename=' in cd:
            return cd.split('filename=')[1].strip('"')
            
        # Try URL path
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path)
        if filename:
            return filename
            
        # Default filename
        return f"download_{int(time.time())}"
