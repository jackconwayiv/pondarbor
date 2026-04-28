"""World JSON envelope: gameplay snapshot + per-seat undo stacks."""

from __future__ import annotations

from typing import Any


def _sorted_seat_strings(d: dict[str, Any]) -> list[str]:
    keys = []
    for k in d.keys():
        try:
            n = int(k)
        except (TypeError, ValueError):
            continue
        if n >= 0:
            keys.append(str(n))
    keys.sort(key=int)
    return keys


def _ensure_undo_lists(undo: dict[str, Any], seats: list[str]) -> dict[str, list[Any]]:
    out: dict[str, list[Any]] = {}
    for k in seats:
        v = undo.get(k)
        out[k] = list(v) if isinstance(v, list) else []
    return out


def unwrap_world_json(
    world_json: dict[str, Any] | None,
    *,
    fallback_seats: tuple[str, ...] = ("0", "1"),
) -> tuple[dict[str, Any], dict[str, list[Any]]]:
    """Return (world, undo_stacks_by_seat). Seat keys are derived from stored undo or fallback."""
    if not world_json:
        return {}, _ensure_undo_lists({}, list(fallback_seats))
    if isinstance(world_json, dict) and "world" in world_json:
        world = world_json.get("world") or {}
        raw_undo = world_json.get("undoStacksBySeat") or {}
        seat_keys = _sorted_seat_strings(raw_undo) if raw_undo else list(fallback_seats)
        if not seat_keys:
            seat_keys = list(fallback_seats)
        undo = _ensure_undo_lists(raw_undo, seat_keys)
        return world, undo
    return world_json, _ensure_undo_lists({}, list(fallback_seats))


def wrap_world_json(
    world: dict[str, Any],
    undo_stacks_by_seat: dict[str, list[Any]] | None,
    *,
    seat_keys_to_retain: list[str] | None = None,
) -> dict[str, Any]:
    """Wrap inner world snapshot; persists every seat undo list."""
    raw = undo_stacks_by_seat or {}
    if seat_keys_to_retain:
        seats = sorted({str(k) for k in seat_keys_to_retain}, key=int)
    else:
        seats = _sorted_seat_strings(raw) or ["0", "1"]
    out_undo: dict[str, list[Any]] = _ensure_undo_lists(raw, seats)
    return {"world": world, "undoStacksBySeat": out_undo}

