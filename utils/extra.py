
import asyncio
import aiohttp
import logging
from config import get_settings

logger = logging.getLogger(__name__)

async def ping_server():
    """Auto-ping server to keep it alive"""
    settings = get_settings()
    
    if settings.PING_INTERVAL <= 0 or not settings.PING_URL:
        return
        
    while True:
        try:
            await asyncio.sleep(settings.PING_INTERVAL)
            
            async with aiohttp.ClientSession() as session:
                async with session.get(settings.PING_URL, timeout=30) as response:
                    if response.status == 200:
                        logger.info("Auto-ping successful")
                    else:
                        logger.warning(f"Auto-ping failed: {response.status}")
                        
        except Exception as e:
            logger.error(f"Auto-ping error: {e}")
            
async def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
        
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
        
    return f"{size_bytes:.1f} PB"

def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    import re
    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    return filename
