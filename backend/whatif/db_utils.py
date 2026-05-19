"""SQLite helpers for WhatIf session writes under concurrent polls."""

from __future__ import annotations

import logging
import time
from functools import wraps
from typing import Callable, ParamSpec, TypeVar, overload

from django.db import OperationalError, connection

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def configure_sqlite_busy_timeout() -> None:
    """Apply PRAGMA busy_timeout from settings on the default connection."""
    timeout_s = connection.settings_dict.get("OPTIONS", {}).get("timeout", 5)
    timeout_ms = int(float(timeout_s) * 1000) if timeout_s else 5000
    if connection.vendor == "sqlite":
        # PRAGMA does not support bound parameters on SQLite.
        with connection.cursor() as cursor:
            cursor.execute(f"PRAGMA busy_timeout = {int(timeout_ms)}")


@overload
def retry_on_db_locked(
    fn: Callable[P, R],
    /,
    *,
    max_attempts: int = ...,
    initial_delay_s: float = ...,
    backoff: float = ...,
) -> Callable[P, R]: ...


@overload
def retry_on_db_locked(
    *,
    max_attempts: int = ...,
    initial_delay_s: float = ...,
    backoff: float = ...,
) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def retry_on_db_locked(
    fn: Callable[P, R] | None = None,
    /,
    *,
    max_attempts: int = 8,
    initial_delay_s: float = 0.05,
    backoff: float = 0.25,
) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
    """Retry on SQLite database is locked (e.g. concurrent declare-winner polls)."""

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            configure_sqlite_busy_timeout()
            last_exc: OperationalError | None = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except OperationalError as exc:
                    last_exc = exc
                    msg = str(exc).lower()
                    if "locked" not in msg or attempt >= max_attempts - 1:
                        raise
                    logger.warning(
                        "whatif db locked attempt %s/%s: %s",
                        attempt + 1,
                        max_attempts,
                        exc,
                    )
                    time.sleep(backoff)
            assert last_exc is not None
            raise last_exc

        return wrapper

    if fn is not None:
        return decorator(fn)
    return decorator
