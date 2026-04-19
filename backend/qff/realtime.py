"""QFF broadcast helpers for Django Channels."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


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
