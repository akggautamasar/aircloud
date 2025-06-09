
import asyncio
import subprocess
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def get_video_duration(file_path: str) -> int:
    """Get video duration in seconds using ffprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            file_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            duration = float(stdout.decode().strip())
            return int(duration)
            
    except Exception as e:
        logger.error(f"Error getting video duration: {e}")
    
    return 0

async def get_audio_duration(file_path: str) -> int:
    """Get audio duration in seconds using ffprobe"""
    return await get_video_duration(file_path)  # Same method works for audio

def get_file_type_from_extension(filename: str) -> str:
    """Get file type category from extension"""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    
    video_exts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v']
    audio_exts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
    image_exts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
    
    if ext in video_exts:
        return 'video'
    elif ext in audio_exts:
        return 'audio'
    elif ext in image_exts:
        return 'image'
    else:
        return 'document'
