"""Entry point: starts the local server and opens the app in the browser."""

import os
import random
import socket
import threading
import webbrowser

from app.config import HOST, PREFERRED_PORT
from app.server import create_app

# Bright ANSI accents; one is picked at random on every launch.
ACCENTS = ["\033[96m", "\033[95m", "\033[94m", "\033[92m", "\033[93m"]
YELLOW = "\033[93m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def find_free_port(preferred):
    """Use the preferred port if free; otherwise ask the system for one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, preferred))
            return preferred
        except OSError:
            s.bind((HOST, 0))
            return s.getsockname()[1]


def banner(url):
    if os.name == "nt":
        os.system("")  # enable ANSI escape codes on Windows consoles
    accent = random.choice(ACCENTS)
    print()
    print(f"  {accent}{BOLD}♪ Songs & Words{RESET}")
    print(f"  {DIM}Running at{RESET} {accent}{url}{RESET}")
    print(f"  {YELLOW}{BOLD}Press Ctrl+C to stop the server{RESET}"
          f"{DIM} — or simply close the browser tab.{RESET}")
    print()


def main():
    app = create_app()
    port = find_free_port(PREFERRED_PORT)
    url = f"http://{HOST}:{port}/"

    threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    banner(url)
    try:
        app.run(host=HOST, port=port, debug=False)
    except KeyboardInterrupt:
        print(f"\n  {BOLD}Bye! Keep singing ♪{RESET}\n")


if __name__ == "__main__":
    main()
