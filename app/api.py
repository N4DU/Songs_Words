"""JSON endpoints consumed by the web interface."""

import json
import re
import uuid

from flask import Blueprint, jsonify, request

from app import database as db
from app import lifecycle
from app.config import ALLOWED_IMAGE_EXTENSIONS, IMAGES_DIR

api = Blueprint("api", __name__, url_prefix="/api")

DIRECTIONS = {"es_to_en", "en_to_es"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _error(message, status=400):
    return jsonify({"error": message}), status


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
    words = [
        {"english": w.get("english", "").strip(), "spanish": w.get("spanish", "").strip()}
        for w in raw
    ]
    words = [w for w in words if w["english"] and w["spanish"]]
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
    song_id = db.create_song(title, image, color, words)
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
    if image is not None:
        _delete_image(current["image"])
    db.update_song(song_id, title, image, color, words)
    return jsonify(db.get_song(song_id))


@api.delete("/songs/<int:song_id>")
def songs_delete(song_id):
    image = db.delete_song(song_id)
    _delete_image(image)
    return jsonify({"ok": True})


@api.put("/songs/<int:song_id>/selected")
def songs_select(song_id):
    data = request.get_json(silent=True) or {}
    db.set_selected(song_id, bool(data.get("selected")))
    return jsonify({"ok": True})


# ---------- Practice ----------

@api.get("/practice")
def practice():
    ids_param = request.args.get("ids", "")
    ids = [int(x) for x in ids_param.split(",") if x.strip().isdigit()]
    return jsonify(db.practice_songs(ids or None))


# ---------- Settings ----------

@api.get("/settings")
def settings_get():
    return jsonify({"direction": db.get_setting("direction", "es_to_en")})


@api.put("/settings")
def settings_put():
    data = request.get_json(silent=True) or {}
    direction = data.get("direction")
    if direction not in DIRECTIONS:
        return _error("Invalid direction")
    db.set_setting("direction", direction)
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
