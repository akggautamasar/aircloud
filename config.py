
from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    # Telegram API credentials
    API_ID: int
    API_HASH: str
    BOT_TOKENS: str = ""  # Comma-separated
    STRING_SESSIONS: str = ""  # Comma-separated premium sessions
    MAIN_BOT_TOKEN: Optional[str] = None
    
    # Storage configuration
    STORAGE_CHANNEL: int
    TELEGRAM_ADMIN_IDS: str = ""  # Comma-separated
    
    # Admin access
    ADMIN_PASSWORD: str = "admin123"
    
    # Supabase configuration
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # Server configuration
    PORT: int = 8000
    PING_INTERVAL: int = 300  # Auto-ping interval in seconds (0 to disable)
    PING_URL: Optional[str] = None
    
    # File limits
    MAX_FILE_SIZE: int = 4 * 1024 * 1024 * 1024  # 4GB for premium
    MAX_FILE_SIZE_BOT: int = 2 * 1024 * 1024 * 1024  # 2GB for bots
    
    # Streaming configuration
    CHUNK_SIZE: int = 1024 * 1024  # 1MB chunks
    MAX_CONCURRENT_DOWNLOADS: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def bot_token_list(self) -> List[str]:
        return [token.strip() for token in self.BOT_TOKENS.split(",") if token.strip()]
    
    @property
    def session_list(self) -> List[str]:
        return [session.strip() for session in self.STRING_SESSIONS.split(",") if session.strip()]
    
    @property
    def admin_ids(self) -> List[int]:
        return [int(id.strip()) for id in self.TELEGRAM_ADMIN_IDS.split(",") if id.strip().isdigit()]

def get_settings() -> Settings:
    return Settings()
