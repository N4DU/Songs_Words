"""Paths and constants shared across the application."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "songs_words.db"

HOST = "127.0.0.1"
PREFERRED_PORT = 8765

# Seconds to wait after the page says goodbye before shutting down
# (a reload sends a new hello within this window and cancels it).
SHUTDOWN_GRACE = 3

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
