"""SQLite access: schema and operations on songs, words and settings."""

import sqlite3

from app.config import DATA_DIR, DB_PATH, IMAGES_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image TEXT,
    color TEXT,
    selected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    english TEXT NOT NULL,
    spanish TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)
    with _connect() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def _migrate(conn):
    """Bring databases created by older versions up to date."""
    columns = [row[1] for row in conn.execute("PRAGMA table_info(songs)")]
    if "color" not in columns:
        conn.execute("ALTER TABLE songs ADD COLUMN color TEXT")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ---------- Songs ----------

def list_songs():
    with _connect() as conn:
        rows = conn.execute(
            """SELECT s.id, s.title, s.image, s.color, s.selected, s.created_at,
                      COUNT(w.id) AS word_count
               FROM songs s LEFT JOIN words w ON w.song_id = s.id
               GROUP BY s.id
               ORDER BY s.selected DESC, s.created_at DESC, s.id DESC"""
        ).fetchall()
    return [dict(r) for r in rows]


def get_song(song_id):
    with _connect() as conn:
        song = conn.execute("SELECT * FROM songs WHERE id = ?", (song_id,)).fetchone()
        if song is None:
            return None
        words = conn.execute(
            "SELECT id, english, spanish FROM words WHERE song_id = ? ORDER BY position, id",
            (song_id,),
        ).fetchall()
    result = dict(song)
    result["words"] = [dict(w) for w in words]
    return result


def create_song(title, image, color, words):
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO songs (title, image, color) VALUES (?, ?, ?)",
            (title, image, color),
        )
        song_id = cur.lastrowid
        _insert_words(conn, song_id, words)
    return song_id


def update_song(song_id, title, image, color, words):
    """Update title, color and words; keep the current image when image is None."""
    with _connect() as conn:
        if image is not None:
            conn.execute(
                "UPDATE songs SET title = ?, image = ?, color = ? WHERE id = ?",
                (title, image, color, song_id),
            )
        else:
            conn.execute(
                "UPDATE songs SET title = ?, color = ? WHERE id = ?",
                (title, color, song_id),
            )
        conn.execute("DELETE FROM words WHERE song_id = ?", (song_id,))
        _insert_words(conn, song_id, words)


def _insert_words(conn, song_id, words):
    conn.executemany(
        "INSERT INTO words (song_id, english, spanish, position) VALUES (?, ?, ?, ?)",
        [(song_id, w["english"], w["spanish"], i) for i, w in enumerate(words)],
    )


def delete_song(song_id):
    """Delete the song and return its image filename (if it had one)."""
    with _connect() as conn:
        row = conn.execute("SELECT image FROM songs WHERE id = ?", (song_id,)).fetchone()
        conn.execute("DELETE FROM songs WHERE id = ?", (song_id,))
    return row["image"] if row else None


def set_selected(song_id, selected):
    with _connect() as conn:
        conn.execute(
            "UPDATE songs SET selected = ? WHERE id = ?", (1 if selected else 0, song_id)
        )


def practice_songs(ids=None):
    """Songs with their words: the ones given by id, or the selected ones."""
    with _connect() as conn:
        if ids:
            marks = ",".join("?" * len(ids))
            rows = conn.execute(
                f"SELECT id FROM songs WHERE id IN ({marks}) ORDER BY created_at, id",
                ids,
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id FROM songs WHERE selected = 1 ORDER BY created_at, id"
            ).fetchall()
    return [get_song(r["id"]) for r in rows]


# ---------- Settings ----------

def get_setting(key, default):
    with _connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key, value):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
