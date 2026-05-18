"""WhatIf broadcast helpers for Django Channels."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from whatif.models import WhatIfSession


def whatif_session_group_name(code: str) -> str:
    return f"whatif_session_{code.upper()}"


async def async_notify_whatif_session(code: str, *, state_version: int) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    await layer.group_send(
        whatif_session_group_name(code),
        {"type": "session_update", "state_version": state_version},
    )


def notify_whatif_session(code: str, *, state_version: int | None = None) -> None:
    """Notify all WhatIf WebSocket clients in the room (sync, from views)."""
    layer = get_channel_layer()
    if not layer:
        return
    version = state_version
    if version is None:
        version = (
            WhatIfSession.objects.filter(short_code=code.upper())
            .values_list("state_version", flat=True)
            .first()
        )
        if version is None:
            return
    async_to_sync(async_notify_whatif_session)(code, state_version=int(version))
