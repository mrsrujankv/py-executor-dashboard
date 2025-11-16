"""
Configuration file for Python Executor Dashboard
"""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent.parent

# Backend directory
BACKEND_DIR = BASE_DIR / "backend"

# Frontend directory
FRONTEND_DIR = BASE_DIR / "frontend"

# Logs directory
LOGS_DIR = BACKEND_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Flask Configuration
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "True") == "True"
FLASK_ENV = os.getenv("FLASK_ENV", "development")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 5000))

# Task Configuration
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB
TASK_TIMEOUT = 3600  # 1 hour

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Features
ENABLE_TASK_HISTORY = True
ENABLE_LOG_DOWNLOAD = True
ENABLE_LOG_COPY = True
MAX_TASKS_IN_MEMORY = 100
