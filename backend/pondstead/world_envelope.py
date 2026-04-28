"""World JSON envelope: gameplay snapshot + per-seat undo stacks."""

from __future__ import annotations

from typing import Any


def unwrap_world_json(world_json: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, list[Any]]]:
    """Return (world, undo_stacks_by_seat). Legacy flat dicts become world with empty undo."""
    if not world_json:
        return {}, {"0": [], "1": []}
    if isinstance(world_json, dict) and "world" in world_json:
        world = world_json.get("world") or {}
        raw_undo = world_json.get("undoStacksBySeat") or {}
        undo: dict[str, list[Any]] = {"0": [], "1": []}
        for k in ("0", "1"):
            v = raw_undo.get(k)
            undo[k] = list(v) if isinstance(v, list) else []
        return world, undo
    return world_json, {"0": [], "1": []}


def wrap_world_json(world: dict[str, Any], undo_stacks_by_seat: dict[str, list[Any]] | None) -> dict[str, Any]:
    u = undo_stacks_by_seat or {"0": [], "1": []}
    out_undo: dict[str, list[Any]] = {}
    for k in ("0", "1"):
        v = u.get(k)
        out_undo[k] = list(v) if isinstance(v, list) else []
    return {"world": world, "undoStacksBySeat": out_undo}
