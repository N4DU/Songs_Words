"""Server lifecycle: clean shutdown driven by browser notifications.

Instead of polling, the page notifies the server when it is about to
disappear (via `navigator.sendBeacon` on `pagehide`). The server then waits
a short grace period: if a new page says hello in time (a reload, or the
same app opened again), the shutdown is cancelled. Explicit shutdown comes
from the UI's "Exit" option.

Pages are counted, not tracked one at a time: several tabs may be open, so
the server only leaves when the last one is gone.
"""

import os
import threading
import time

from app.config import SHUTDOWN_GRACE

_clients = 0
_lock = threading.Lock()


def hello():
    """A page is alive: count it and cancel any pending shutdown."""
    global _clients
    with _lock:
        _clients += 1


def goodbye():
    """A page went away: shut down if it was the last one."""
    global _clients
    with _lock:
        _clients = max(0, _clients - 1)
        if _clients > 0:
            return

    def _check():
        time.sleep(SHUTDOWN_GRACE)
        with _lock:
            alone = _clients == 0
        if alone:
            os._exit(0)

    threading.Thread(target=_check, daemon=True).start()


def shutdown(delay=0.4):
    """Stop the process after a short delay so the response can be sent."""

    def _exit():
        time.sleep(delay)
        os._exit(0)

    threading.Thread(target=_exit, daemon=True).start()
