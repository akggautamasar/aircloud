
# Telegram File Manager - Python Backend

A FastAPI backend for streaming and managing files through Telegram, designed for deployment on Koyeb.

## Features

- **File Streaming**: Stream large files with byte-range support for videos
- **Multiple Clients**: Support for both bot tokens and premium user sessions
- **File Upload**: Upload files via web interface or Telegram bot
- **URL Download**: Download files from URLs directly to Telegram storage
- **Database Integration**: Full integration with Supabase database
- **Bot Mode**: Upload files directly through Telegram bot
- **Progress Tracking**: Real-time upload/download progress
- **Auto-ping**: Keep server alive with configurable ping intervals

## Deployment on Koyeb

1. **Fork this repository**

2. **Set up environment variables in Koyeb:**
   ```
   API_ID=your_telegram_api_id
   API_HASH=your_telegram_api_hash
   BOT_TOKENS=bot_token_1,bot_token_2
   STRING_SESSIONS=session_1,session_2
   STORAGE_CHANNEL=-1001234567890
   ADMIN_PASSWORD=your_secure_password
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Deploy to Koyeb:**
   - Connect your GitHub repository
   - Select the Dockerfile build option
   - Configure environment variables
   - Deploy

## Configuration

### Required Environment Variables

- `API_ID`: Telegram API ID
- `API_HASH`: Telegram API Hash
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `STORAGE_CHANNEL`: Telegram channel ID for file storage
- `ADMIN_PASSWORD`: Password for admin access

### Optional Environment Variables

- `BOT_TOKENS`: Comma-separated bot tokens
- `STRING_SESSIONS`: Comma-separated premium account sessions
- `MAIN_BOT_TOKEN`: Bot token for bot mode
- `TELEGRAM_ADMIN_IDS`: Comma-separated admin user IDs
- `PING_INTERVAL`: Auto-ping interval in seconds (default: 300)
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 4GB)

## API Endpoints

### File Management
- `GET /api/files` - List all files
- `POST /api/upload` - Upload file
- `POST /api/download-url` - Download from URL
- `DELETE /api/files/{file_id}` - Delete file

### Streaming
- `GET /api/stream/{file_id}` - Stream file with range support
- `GET /api/download/{file_id}` - Download file as attachment

### Admin
- `GET /api/stats` - Get server statistics
- `POST /api/backup` - Backup database
- `POST /api/restore` - Restore database
- `GET /api/progress/{task_id}` - Get upload progress

## Bot Mode

If `MAIN_BOT_TOKEN` is configured, the bot will accept file uploads from authorized users:

- Send any file to the bot
- Use `/stats` to view storage statistics
- Use `/help` for help information

## Integration with React Frontend

This backend is designed to work with your existing React frontend. Update your frontend to use the new streaming endpoints:

```javascript
// Stream URL for video playback
const streamUrl = `https://your-app.koyeb.app/api/stream/${fileId}`;

// Download URL
const downloadUrl = `https://your-app.koyeb.app/api/download/${fileId}`;
```

## File Size Limits

- **Premium Accounts**: 4GB per file
- **Bot Accounts**: 2GB per file
- **URL Downloads**: Limited by available memory and Telegram limits

## Logging

The application includes comprehensive logging for debugging and monitoring. Logs include:
- Client connections
- File operations
- Streaming requests
- Bot interactions
- Errors and exceptions
