"""Persist per-seat private state rows from stitched world data."""

from __future__ import annotations

from typing import Any

from .models import PondsteadGame, PondsteadPlayerPrivateState, PondsteadSharedWorldState


def _seat_submaps(world: dict[str, Any], seat_key: str) -> dict[str, Any]:
    keys = ("pursesBySeat", "revealedBySeat", "scoutedTodayBySeat", "stackMovementBySeat", "bonusPointsBySeat")
    out: dict[str, Any] = {}
    for k in keys:
        sub = world.get(k)
        subd = sub if isinstance(sub, dict) else {}
        out[k] = {seat_key: subd.get(seat_key)}
    return out


def sync_player_private_states_from_world(
    game_id: int,
    world: dict[str, Any],
    undo_by_seat: dict[str, list[Any]],
) -> None:
    """Persist per-seat private fields from stitched world payload."""

    game = PondsteadGame.objects.get(pk=game_id)
    for player in game.players.order_by("seat_index"):
        sk = str(player.seat_index)
        blob = _seat_submaps(world, sk)
        blob["undoStack"] = list(undo_by_seat.get(sk) or [])
        ruk = world.get("recruitUsedThisDayKeys")
        if ruk is not None:
            blob["recruitUsedThisDayKeys"] = ruk
        if world.get("day") is not None:
            blob["day"] = world["day"]
        PondsteadPlayerPrivateState.objects.update_or_create(player=player, defaults={"data": blob})


def sync_shared_world_from_world_blob(game_id: int, world: dict[str, Any], revision: int) -> None:
    """Persist shared placement layer into PondsteadSharedWorldState."""
    shared = {
        "map": world.get("map"),
        "stacks": world.get("stacks") or [],
        # day is campaign-level but convenient to embed alongside the map snapshot
        "day": world.get("day"),
    }
    PondsteadSharedWorldState.objects.update_or_create(
        game_id=game_id,
        defaults={"revision": int(revision), "data": shared},
    )
