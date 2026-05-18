from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

ESTATES_LOBBIES_GROUP = "estates_lobbies"


def estates_game_group_name(game_id: str) -> str:
    return f"estates_game_{game_id}"


async def async_notify_estates_game(game_id: str) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    await layer.group_send(
        estates_game_group_name(game_id),
        {"type": "game_update"},
    )


def notify_estates_game(game_id: str) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(async_notify_estates_game)(game_id)


async def async_notify_estates_lobbies() -> None:
    layer = get_channel_layer()
    if not layer:
        return
    await layer.group_send(
        ESTATES_LOBBIES_GROUP,
        {"type": "lobbies_update"},
    )


def notify_estates_lobbies() -> None:
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(async_notify_estates_lobbies)()

