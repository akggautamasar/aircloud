
import asyncio
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client

from config import get_settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.settings = get_settings()
        self.supabase: Optional[Client] = None
        
    async def initialize(self):
        """Initialize Supabase client"""
        try:
            self.supabase = create_client(
                self.settings.SUPABASE_URL,
                self.settings.SUPABASE_SERVICE_ROLE_KEY
            )
            logger.info("Supabase client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase: {e}")
            raise e
            
    async def save_file(self, file_data: dict) -> bool:
        """Save file metadata to database"""
        try:
            result = self.supabase.table('telegram_files').insert(file_data).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Database save error: {e}")
            return False
            
    async def get_user_files(self, user_id: Optional[str] = None) -> List[dict]:
        """Get files for a user or all files"""
        try:
            query = self.supabase.table('telegram_files').select('*')
            
            if user_id:
                query = query.eq('user_id', user_id)
                
            result = query.order('uploaded_at', desc=True).execute()
            return result.data
        except Exception as e:
            logger.error(f"Database query error: {e}")
            return []
            
    async def get_file_by_telegram_id(self, telegram_file_id: str) -> Optional[dict]:
        """Get file by Telegram file ID"""
        try:
            result = self.supabase.table('telegram_files').select('*').eq(
                'telegram_file_id', telegram_file_id
            ).single().execute()
            return result.data
        except Exception as e:
            logger.error(f"File lookup error: {e}")
            return None
            
    async def delete_file(self, file_id: str) -> bool:
        """Delete file from database"""
        try:
            result = self.supabase.table('telegram_files').delete().eq(
                'id', file_id
            ).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Database delete error: {e}")
            return False
            
    async def get_stats(self) -> dict:
        """Get database statistics"""
        try:
            # Count files
            files_result = self.supabase.table('telegram_files').select(
                'id', count='exact'
            ).execute()
            
            # Get total size
            size_result = self.supabase.table('telegram_files').select(
                'file_size'
            ).execute()
            
            total_size = sum(row.get('file_size', 0) for row in size_result.data)
            
            return {
                "total_files": len(files_result.data),
                "total_size": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2)
            }
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return {"total_files": 0, "total_size": 0, "total_size_mb": 0}
            
    async def backup_to_json(self) -> dict:
        """Backup database to JSON"""
        try:
            files = await self.get_user_files()
            return {
                "backup_date": datetime.now().isoformat(),
                "files": files
            }
        except Exception as e:
            logger.error(f"Backup error: {e}")
            return {}
            
    async def restore_from_json(self, backup_data: dict) -> bool:
        """Restore database from JSON backup"""
        try:
            files = backup_data.get("files", [])
            
            for file_data in files:
                # Remove id to let database generate new ones
                if 'id' in file_data:
                    del file_data['id']
                await self.save_file(file_data)
                
            return True
        except Exception as e:
            logger.error(f"Restore error: {e}")
            return False
