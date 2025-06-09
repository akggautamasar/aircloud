
import logging
import sys
from datetime import datetime

def setup_logger(name: str = "telegram_manager", level: int = logging.INFO) -> logging.Logger:
    """Setup logger with custom formatting"""
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Don't add handlers if they already exist
    if logger.handlers:
        return logger
    
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    
    # Create formatter
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger

def log_request(method: str, path: str, status_code: int, duration: float):
    """Log HTTP request"""
    logger = logging.getLogger("telegram_manager")
    logger.info(f"{method} {path} - {status_code} ({duration:.2f}ms)")
