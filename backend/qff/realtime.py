"""QFF broadcast helpers for Django Channels."""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterable
from typing import Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import close_old_connections

logger = logging.getLogger(__name__)


async def async_notify_qff_rooms(room_ids: Iterable[Optional[int]]) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    seen: set[int] = set()
    for rid in room_ids:
        if rid is None or rid in seen:
            continue
        seen.add(rid)
        await layer.group_send(
            f"qff_room_{rid}",
            {"type": "room_update"},
        )


def notify_qff_rooms(room_ids: Iterable[Optional[int]]) -> None:
    """Notify all QFF WebSocket clients in the given rooms (sync, from views)."""
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(async_notify_qff_rooms)(room_ids)


def schedule_notify_qff_rooms(room_ids: Iterable[Optional[int]]) -> None:
    """Run :func:`notify_qff_rooms` on a daemon thread after returning (non-blocking for callers)."""
    ids = tuple(room_ids)

    def _run() -> None:
        close_old_connections()
        try:
            notify_qff_rooms(ids)
        except Exception:
            logger.exception("schedule_notify_qff_rooms failed")
        finally:
            close_old_connections()

    threading.Thread(target=_run, daemon=True).start()
