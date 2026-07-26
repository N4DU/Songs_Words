"""Entry point: starts the local server and opens the app in the browser."""

import socket
import threading
import webbrowser

from app.config import HOST, PREFERRED_PORT
from app.server import create_app


def find_free_port(preferred):
    """Use the preferred port if free; otherwise ask the system for one."""
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

    threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    print(f"♪ Songs & Words running at {url}")
    print("  It stops on its own when you close the tab, or from the Exit option.")
    app.run(host=HOST, port=port, debug=False)


if __name__ == "__main__":
    main()
