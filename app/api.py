"""JSON endpoints consumed by the web interface."""

import json
import re
import uuid
from urllib.parse import urlsplit

from flask import Blueprint, jsonify, request

from app import database as db
from app import lifecycle
from app.config import ALLOWED_IMAGE_EXTENSIONS, IMAGES_DIR

api = Blueprint("api", __name__, url_prefix="/api")

DIRECTIONS = {"to_word", "to_translation"}
LANGUAGES = {"en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ko"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
# The server only ever answers the local page; anything reaching it under
# another name is a DNS-rebinding attempt.
LOCAL_HOSTS = {"127.0.0.1", "localhost"}


def _error(message, status=400):
    return jsonify({"error": message}), status


def local_host_guard():
    """Reject requests addressed to a host other than the loopback one."""
    if request.host.rsplit(":", 1)[0] not in LOCAL_HOSTS:
        return _error("Forbidden", 403)
    return None


@api.before_request
def _guard_api():
    """Keep the API reachable only from the page this server serves."""
    blocked = local_host_guard()
    if blocked is not None:
        return blocked
    # Browsers attach Origin to cross-site requests, including the "simple"
    # ones (form posts, sendBeacon) that no preflight would stop.
    origin = request.headers.get("Origin")
    if origin is not None:
        parts = urlsplit(origin)
        if parts.scheme != "http" or parts.hostname not in LOCAL_HOSTS:
            return _error("Forbidden", 403)
    return None


def _save_image(file):
    """Store the uploaded image and return its filename, or None if absent."""
    if file is None or file.filename == "":
        return None
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Image format not allowed")
    name = uuid.uuid4().hex + ext
    file.save(IMAGES_DIR / name)
    return name


def _delete_image(name):
    if not name:
        return
    path = IMAGES_DIR / name
    if path.is_file():
        path.unlink()


def _parse_song_form():
    """Validate the song form and return (title, words, color, image_or_None)."""
    title = (request.form.get("title") or "").strip()
    if not title:
        raise ValueError("The song needs a title")
    try:
        raw = json.loads(request.form.get("words") or "[]")
    except json.JSONDecodeError:
        raise ValueError("Invalid word list")
    if not isinstance(raw, list) or any(not isinstance(w, dict) for w in raw):
        raise ValueError("Invalid word list")
    words = [
        {
            "word": str(w.get("word") or "").strip(),
            "translation": str(w.get("translation") or "").strip(),
        }
        for w in raw
    ]
    words = [w for w in words if w["word"] and w["translation"]]
    if not words:
        raise ValueError("Add at least one complete word")
    color = (request.form.get("color") or "").strip()
    color = color if HEX_COLOR.match(color) else None
    image = _save_image(request.files.get("image"))
    return title, words, color, image


# ---------- Songs ----------

@api.get("/songs")
def songs_list():
    return jsonify(db.list_songs())


@api.post("/songs")
def songs_create():
    try:
        title, words, color, image = _parse_song_form()
    except ValueError as e:
        return _error(str(e))
    try:
        song_id = db.create_song(title, image, color, words)
    except Exception:
        _delete_image(image)  # do not leave the upload behind
        raise
    return jsonify(db.get_song(song_id)), 201


@api.get("/songs/<int:song_id>")
def songs_get(song_id):
    song = db.get_song(song_id)
    if song is None:
        return _error("Song not found", 404)
    return jsonify(song)


@api.put("/songs/<int:song_id>")
def songs_update(song_id):
    current = db.get_song(song_id)
    if current is None:
        return _error("Song not found", 404)
    try:
        title, words, color, image = _parse_song_form()
    except ValueError as e:
        return _error(str(e))
    db.update_song(song_id, title, image, color, words)
    if image is not None:
        # Only now that the new image is recorded is the old one useless.
        _delete_image(current["image"])
    return jsonify(db.get_song(song_id))


@api.delete("/songs/<int:song_id>")
def songs_delete(song_id):
    deleted, image = db.delete_song(song_id)
    if not deleted:
        return _error("Song not found", 404)
    _delete_image(image)
    return jsonify({"ok": True})


@api.put("/songs/<int:song_id>/selected")
def songs_select(song_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        data = {}
    if not db.set_selected(song_id, bool(data.get("selected"))):
        return _error("Song not found", 404)
    return jsonify({"ok": True})


# ---------- Practice ----------

@api.get("/practice")
def practice():
    ids_param = request.args.get("ids", "")
    # isdigit() alone would accept digits int() rejects, such as '²'.
    ids = [
        int(x.strip())
        for x in ids_param.split(",")
        if x.strip().isascii() and x.strip().isdigit()
    ]
    return jsonify(db.practice_songs(ids or None))


# ---------- Settings ----------

@api.get("/settings")
def settings_get():
    return jsonify({
        "direction": db.get_setting("direction", "to_word"),
        "language": db.get_setting("language", "en"),
        "retry_missed": db.get_setting("retry_missed", "1") == "1",
        "ignore_accents": db.get_setting("ignore_accents", "1") == "1",
        # One leniency rule per interface language; all on by default except
        # the Italian one, which would accept too much for most learners.
        "en_apostrophes": db.get_setting("en_apostrophes", "1") == "1",
        "es_inverted_marks": db.get_setting("es_inverted_marks", "1") == "1",
        "fr_ligatures": db.get_setting("fr_ligatures", "1") == "1",
        "de_eszett": db.get_setting("de_eszett", "1") == "1",
        "it_double_consonants": db.get_setting("it_double_consonants", "0") == "1",
        "pt_cedilla": db.get_setting("pt_cedilla", "1") == "1",
        "ru_yo": db.get_setting("ru_yo", "1") == "1",
        "ja_kana": db.get_setting("ja_kana", "1") == "1",
        "zh_width": db.get_setting("zh_width", "1") == "1",
        "ko_jamo": db.get_setting("ko_jamo", "1") == "1",
    })


@api.put("/settings")
def settings_put():
    """Partial update: only the keys present in the body are changed."""
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return _error("Invalid settings")
    if "direction" in data:
        if not isinstance(data["direction"], str) or data["direction"] not in DIRECTIONS:
            return _error("Invalid direction")
        db.set_setting("direction", data["direction"])
    if "language" in data:
        if not isinstance(data["language"], str) or data["language"] not in LANGUAGES:
            return _error("Invalid language")
        db.set_setting("language", data["language"])
    for key in ("retry_missed", "ignore_accents",
                "en_apostrophes", "es_inverted_marks", "fr_ligatures",
                "de_eszett", "it_double_consonants", "pt_cedilla",
                "ru_yo", "ja_kana", "zh_width", "ko_jamo"):
        if key in data:
            db.set_setting(key, "1" if data[key] else "0")
    return jsonify({"ok": True})


# ---------- Lifecycle ----------

@api.post("/hello")
def hello():
    lifecycle.hello()
    return jsonify({"ok": True})


@api.post("/goodbye")
def goodbye():
    lifecycle.goodbye()
    return jsonify({"ok": True})


@api.post("/shutdown")
def shutdown():
    lifecycle.shutdown()
    return jsonify({"ok": True})
