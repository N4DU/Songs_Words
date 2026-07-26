"""Construcción de la aplicación Flask que sirve la interfaz y la API."""

from flask import Flask, send_from_directory

from app.api import api
from app.config import IMAGES_DIR, STATIC_DIR
from app.database import init_db


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
