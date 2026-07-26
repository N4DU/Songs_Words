"""Ciclo de vida del servidor: latidos del navegador y apagado limpio.

El navegador envía un latido cada pocos segundos; si dejan de llegar
(la pestaña se cerró) el vigilante apaga el proceso. El apagado explícito
llega desde la interfaz con la opción «Salir».
"""

import os
import threading
import time

from app.config import HEARTBEAT_GRACE

_last_beat = None
_lock = threading.Lock()


def beat():
    global _last_beat
    with _lock:
        _last_beat = time.time()


def shutdown(delay=0.4):
    """Apaga el proceso tras una pequeña espera para poder responder al cliente."""

    def _exit():
        time.sleep(delay)
        os._exit(0)

    threading.Thread(target=_exit, daemon=True).start()


def start_watchdog():
    def _watch():
        while True:
            time.sleep(2)
            with _lock:
                expired = (
                    _last_beat is not None
                    and time.time() - _last_beat > HEARTBEAT_GRACE
                )
            if expired:
                os._exit(0)

    threading.Thread(target=_watch, daemon=True).start()
