"""Server lifecycle: clean shutdown driven by browser notifications.

Instead of polling, the page notifies the server when it is about to
disappear (via `navigator.sendBeacon` on `pagehide`). The server then waits
a short grace period: if a new page says hello in time (a reload, or the
same app opened again), the shutdown is cancelled. Explicit shutdown comes
from the UI's "Exit" option.
"""

import os
import threading
import time

from app.config import SHUTDOWN_GRACE

_pending = None
_lock = threading.Lock()


def hello():
    """A page is alive: cancel any pending shutdown."""
    global _pending
    with _lock:
        _pending = None


def goodbye():
    """The page is going away: shut down unless another hello arrives."""
    global _pending
    token = object()
    with _lock:
        _pending = token

    def _check():
        time.sleep(SHUTDOWN_GRACE)
        with _lock:
            still_pending = _pending is token
        if still_pending:
            os._exit(0)

    threading.Thread(target=_check, daemon=True).start()


def shutdown(delay=0.4):
    """Stop the process after a short delay so the response can be sent."""

    def _exit():
        time.sleep(delay)
        os._exit(0)

    threading.Thread(target=_exit, daemon=True).start()
