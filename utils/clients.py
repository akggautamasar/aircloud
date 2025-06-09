
import asyncio
import logging
from typing import Dict, List, Optional
from pyrogram import Client
from pyrogram.errors import FloodWait, AuthKeyUnregistered
from config import get_settings

logger = logging.getLogger(__name__)

class TelegramManager:
    def __init__(self):
        self.settings = get_settings()
        self.clients: Dict[str, Client] = {}
        self.active_client: Optional[Client] = None
        self.client_usage = {}
        
    async def initialize(self):
        """Initialize all Telegram clients"""
        await self._create_bot_clients()
        await self._create_user_clients()
        await self._select_best_client()
        
    async def _create_bot_clients(self):
        """Create bot clients from tokens"""
        for i, token in enumerate(self.settings.bot_token_list):
            try:
                client = Client(
                    f"bot_{i}",
                    api_id=self.settings.API_ID,
                    api_hash=self.settings.API_HASH,
                    bot_token=token,
                    workdir="sessions"
                )
                await client.start()
                self.clients[f"bot_{i}"] = client
                self.client_usage[f"bot_{i}"] = 0
                logger.info(f"Bot client {i} connected successfully")
            except Exception as e:
                logger.error(f"Failed to connect bot {i}: {e}")
                
    async def _create_user_clients(self):
        """Create user clients from string sessions"""
        for i, session in enumerate(self.settings.session_list):
            try:
                client = Client(
                    f"user_{i}",
                    api_id=self.settings.API_ID,
                    api_hash=self.settings.API_HASH,
                    session_string=session
                )
                await client.start()
                self.clients[f"user_{i}"] = client
                self.client_usage[f"user_{i}"] = 0
                logger.info(f"User client {i} connected successfully")
            except Exception as e:
                logger.error(f"Failed to connect user {i}: {e}")
                
    async def _select_best_client(self):
        """Select the best client for operations"""
        if not self.clients:
            raise Exception("No Telegram clients available")
            
        # Prefer user clients (premium) over bots
        for name, client in self.clients.items():
            if name.startswith("user_"):
                self.active_client = client
                logger.info(f"Selected user client: {name}")
                return
                
        # Fallback to bot clients
        self.active_client = next(iter(self.clients.values()))
        logger.info("Selected bot client as fallback")
        
    async def get_client(self, prefer_user: bool = True) -> Client:
        """Get the best available client"""
        if prefer_user:
            # Try to get user client first
            for name, client in self.clients.items():
                if name.startswith("user_") and self.client_usage[name] < 3:
                    self.client_usage[name] += 1
                    return client
                    
        # Fallback to least used client
        min_usage = min(self.client_usage.values())
        for name, client in self.clients.items():
            if self.client_usage[name] == min_usage:
                self.client_usage[name] += 1
                return client
                
        return self.active_client
        
    async def release_client(self, client: Client):
        """Release client back to pool"""
        for name, c in self.clients.items():
            if c == client:
                self.client_usage[name] = max(0, self.client_usage[name] - 1)
                break
                
    async def cleanup(self):
        """Cleanup all clients"""
        for client in self.clients.values():
            try:
                await client.stop()
            except Exception as e:
                logger.error(f"Error stopping client: {e}")
