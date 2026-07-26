"""Punto de entrada: levanta el servidor local y abre la app en el navegador."""

import socket
import threading
import webbrowser

from app import lifecycle
from app.config import HOST, PREFERRED_PORT
from app.server import create_app


def find_free_port(preferred):
    """Usa el puerto preferido si está libre; si no, pide uno al sistema."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, preferred))
            return preferred
        except OSError:
            s.bind((HOST, 0))
            return s.getsockname()[1]


def main():
    app = create_app()
    port = find_free_port(PREFERRED_PORT)
    url = f"http://{HOST}:{port}/"

    lifecycle.start_watchdog()
    threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    print(f"Songs & Words corriendo en {url}")
    print("Se cierra solo al cerrar la pestaña, o desde la opción «Salir».")
    app.run(host=HOST, port=port, debug=False)


if __name__ == "__main__":
    main()
