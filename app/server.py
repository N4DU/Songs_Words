"""Flask application setup: serves the interface and the API."""

import logging

import flask.cli
from flask import Flask, send_from_directory

from app.api import api
from app.config import IMAGES_DIR, STATIC_DIR
from app.database import init_db

# Keep the console clean: no per-request logs, no dev-server banner.
logging.getLogger("werkzeug").setLevel(logging.ERROR)
flask.cli.show_server_banner = lambda *args, **kwargs: None


def create_app():
    init_db()
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
    app.register_blueprint(api)

    @app.get("/")
    def index():
        return app.send_static_file("index.html")

    @app.get("/images/<path:name>")
    def images(name):
        return send_from_directory(IMAGES_DIR, name)

    return app
