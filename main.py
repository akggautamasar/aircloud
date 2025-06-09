
from fastapi import FastAPI, Request, HTTPException, Depends, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import asyncio
import os
import logging
from typing import Optional, List
import json
from datetime import datetime
import aiofiles
import tempfile

from config import get_settings
from utils.clients import TelegramManager
from utils.uploader import TelegramUploader
from utils.downloader import URLDownloader
from utils.streamer import ByteStreamer
from utils.directoryHandler import DatabaseManager
from utils.botmode import BotModeHandler
from utils.logger import setup_logger
from utils.extra import ping_server

app = FastAPI(title="Telegram File Manager", version="1.0.0")
security = HTTPBearer()
settings = get_settings()
logger = setup_logger()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize managers
telegram_manager = TelegramManager()
db_manager = DatabaseManager()
uploader = TelegramUploader(telegram_manager, db_manager)
downloader = URLDownloader(telegram_manager, db_manager)
bot_handler = BotModeHandler(telegram_manager, db_manager)
streamer = ByteStreamer(telegram_manager)

@app.on_event("startup")
async def startup_event():
    """Initialize all clients and start background tasks"""
    await telegram_manager.initialize()
    await db_manager.initialize()
    
    # Start bot mode if enabled
    if settings.MAIN_BOT_TOKEN:
        asyncio.create_task(bot_handler.start_bot())
    
    # Start auto-ping if enabled
    if settings.PING_INTERVAL > 0:
        asyncio.create_task(ping_server())
    
    logger.info("FastAPI server started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await telegram_manager.cleanup()
    logger.info("FastAPI server shutdown complete")

async def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin authentication"""
    if credentials.credentials != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/files")
async def list_files(user_id: Optional[str] = None):
    """List all files from database"""
    try:
        files = await db_manager.get_user_files(user_id)
        return {"success": True, "files": files}
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    admin: bool = Depends(verify_admin)
):
    """Upload file to Telegram"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Start upload in background
        background_tasks.add_task(
            uploader.upload_file,
            tmp_path,
            file.filename,
            user_id,
            file.size
        )
        
        return {
            "success": True,
            "message": f"Upload started for {file.filename}",
            "file_size": file.size
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download-url")
async def download_from_url(
    background_tasks: BackgroundTasks,
    request: Request,
    admin: bool = Depends(verify_admin)
):
    """Download file from URL and upload to Telegram"""
    try:
        data = await request.json()
        url = data.get("url")
        filename = data.get("filename")
        user_id = data.get("user_id")
        
        if not url or not user_id:
            raise HTTPException(status_code=400, detail="URL and user_id required")
        
        # Start download in background
        background_tasks.add_task(
            downloader.download_and_upload,
            url,
            filename,
            user_id
        )
        
        return {
            "success": True,
            "message": "Download started",
            "url": url
        }
    except Exception as e:
        logger.error(f"URL download error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream/{file_id}")
async def stream_file(file_id: str, request: Request):
    """Stream file with byte-range support"""
    try:
        # Get file info from database
        file_info = await db_manager.get_file_by_telegram_id(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Handle range requests
        range_header = request.headers.get("range")
        
        if range_header:
            # Parse range header
            range_start, range_end = streamer.parse_range_header(
                range_header, 
                file_info.get("file_size", 0)
            )
            
            # Stream partial content
            return await streamer.stream_partial(
                file_id,
                range_start,
                range_end,
                file_info
            )
        else:
            # Stream full file
            return await streamer.stream_full(file_id, file_info)
            
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Download file as attachment"""
    try:
        file_info = await db_manager.get_file_by_telegram_id(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Stream file as download
        return await streamer.stream_download(file_id, file_info)
        
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str, admin: bool = Depends(verify_admin)):
    """Delete file from Telegram and database"""
    try:
        success = await db_manager.delete_file(file_id)
        if success:
            return {"success": True, "message": "File deleted"}
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats(admin: bool = Depends(verify_admin)):
    """Get server statistics"""
    try:
        stats = await db_manager.get_stats()
        return {
            "success": True,
            "stats": stats,
            "clients_connected": len(telegram_manager.clients),
            "uptime": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/backup")
async def backup_database(admin: bool = Depends(verify_admin)):
    """Backup database to JSON"""
    try:
        backup_data = await db_manager.backup_to_json()
        return {
            "success": True,
            "backup": backup_data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Backup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/restore")
async def restore_database(
    request: Request,
    admin: bool = Depends(verify_admin)
):
    """Restore database from JSON backup"""
    try:
        data = await request.json()
        backup_data = data.get("backup")
        
        if not backup_data:
            raise HTTPException(status_code=400, detail="Backup data required")
        
        success = await db_manager.restore_from_json(backup_data)
        return {
            "success": success,
            "message": "Database restored successfully" if success else "Restore failed"
        }
    except Exception as e:
        logger.error(f"Restore error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/progress/{task_id}")
async def get_progress(task_id: str):
    """Get upload/download progress"""
    try:
        progress = await uploader.get_progress(task_id)
        return {"success": True, "progress": progress}
    except Exception as e:
        logger.error(f"Progress error: {e}")
        return {"success": False, "progress": 0}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=False
    )
