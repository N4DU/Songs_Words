"""Rutas y constantes compartidas por toda la aplicación."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "songs_words.db"

HOST = "127.0.0.1"
PREFERRED_PORT = 8765

# Segundos sin latidos del navegador antes de apagar el servidor.
HEARTBEAT_GRACE = 12

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
