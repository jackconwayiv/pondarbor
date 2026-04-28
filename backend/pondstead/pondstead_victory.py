"""Campaign victory: first unique leader at >= 10 total points (map civic + bonus)."""

from __future__ import annotations

from typing import Any

# Must match frontend PONDSTEAD_VICTORY_POINTS
VICTORY_THRESHOLD = 10


def _bonus_for_seat(world: dict[str, Any], seat: int) -> int:
    raw = world.get("bonusPointsBySeat") or {}
    v = raw.get(str(seat), raw.get(seat))
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def _points_from_map_cells_for_owner(world: dict[str, Any], owner_id: int) -> int:
    m = world.get("map") or {}
    cells = m.get("cells") or []
    p = 0
    wonder = frozenset({"lighthouse", "colossus", "mausoleum", "pyramid", "academy"})
    civic = frozenset({"granary", "sawmill", "masonYard"})
    for row in cells:
        for cell in row:
            if not isinstance(cell, dict):
                continue
            b = cell.get("building")
            if b in (None, "none"):
                continue
            bo = cell.get("buildingOwnerId")
            if bo != owner_id:
                continue
            if b in civic:
                p += 1
            if b in wonder:
                p += 3
    return p


def total_victory_score(world: dict[str, Any], seat: int) -> int:
    return _points_from_map_cells_for_owner(world, seat) + _bonus_for_seat(world, seat)


def victor_seat_index_or_none(world: dict[str, Any]) -> int | None:
    """
    Unique strict global leader with score >= VICTORY_THRESHOLD, or None.
    """
    purses = world.get("pursesBySeat") or {}
    seats: list[int] = []
    try:
        seats = sorted({int(k) for k in purses.keys() if str(k).isdigit() or isinstance(k, int)})
    except Exception:
        seats = []
    if not seats:
        return None
    scores: list[tuple[int, int]] = []
    for s in seats:
        scores.append((s, total_victory_score(world, s)))
    if not scores:
        return None
    max_score = max(sc for _, sc in scores)
    if max_score < VICTORY_THRESHOLD:
        return None
    leaders = [s for s, sc in scores if sc == max_score]
    if len(leaders) != 1:
        return None
    return leaders[0]
