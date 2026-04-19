"""Apply Item.extra_data.consume_effects when a consumable is used."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from qff.models import AreaCell, CharacterRoomVisit, ItemInstance, Room

if TYPE_CHECKING:
    from qff.models import Character, Item


def _coerce_positive_int(val: Any, default: int = 0) -> int:
    try:
        n = int(val)
        return n if n > 0 else default
    except (TypeError, ValueError):
        return default


def _chebyshev(ax: int, ay: int, bx: int, by: int) -> int:
    """Grid distance for minimap light radius (square neighborhood)."""
    return max(abs(ax - bx), abs(ay - by))


def _character_has_inventory_item_slug(character: "Character", slug: str) -> bool:
    want = (slug or "").strip().lower()
    if not want:
        return False
    inv = list(character.inventory or [])
    if not inv:
        return False
    return ItemInstance.objects.filter(
        pk__in=inv,
        owner_character_id=character.pk,
        item__slug__iexact=want,
    ).exists()


def _parse_dark_minimap_lit_ids(character: "Character") -> set[int]:
    raw = character.dark_minimap_lit_room_ids or []
    out_set: set[int] = set()
    for x in raw:
        try:
            out_set.add(int(x))
        except (TypeError, ValueError):
            continue
    return out_set


def dark_minimap_light_additions(character: "Character", radius: int) -> set[int]:
    """Visited rooms in the current area within Chebyshev distance <= radius of current cell."""
    room = character.current_room
    area = room.area
    if not area.is_dark_minimap or radius <= 0:
        return set()

    visited = set(
        CharacterRoomVisit.objects.filter(character=character).values_list(
            "room_id", flat=True
        )
    )
    in_area = set(
        Room.objects.filter(area=area, pk__in=visited).values_list("id", flat=True)
    )
    cells = {
        ac.room_id: (ac.x, ac.y)
        for ac in AreaCell.objects.filter(area=area, room_id__in=in_area)
    }
    cur_id = character.current_room_id
    if cur_id not in cells:
        return set()
    cx, cy = cells[cur_id]
    out: set[int] = set()
    for rid, (x, y) in cells.items():
        if _chebyshev(x, y, cx, cy) <= radius:
            out.add(rid)
    return out


def validate_consume_effects(character: "Character", item: "Item") -> str | None:
    """Return an error message if the consumable must not be applied; else None."""
    raw = (item.extra_data or {}).get("consume_effects")
    if not raw or not isinstance(raw, list):
        return None

    for eff in raw:
        if not isinstance(eff, dict):
            continue
        kind = (eff.get("kind") or "").strip()
        if kind != "dark_minimap_light":
            continue
        radius = _coerce_positive_int(eff.get("radius"), 0)
        if radius <= 0:
            continue
        if not character.current_room.area.is_dark_minimap:
            return "You don't need light here."
        req = (eff.get("requires_item_slug") or "").strip()
        if req and not _character_has_inventory_item_slug(character, req):
            if req.lower() == "lantern":
                return "You need a lantern to use that."
            return "You can't use that without the right gear."
        if not dark_minimap_light_additions(character, radius):
            return "You can't use that here."

    return None


def apply_consume_effects(character: "Character", item: "Item") -> list[str]:
    """Mutate character; return extra message lines (call only after validate_consume_effects)."""
    raw = (item.extra_data or {}).get("consume_effects")
    if not raw or not isinstance(raw, list):
        return []

    lines: list[str] = []
    ch = character
    hp_gain = 0
    mana_gain = 0

    for eff in raw:
        if not isinstance(eff, dict):
            continue
        kind = (eff.get("kind") or "").strip()
        if kind == "heal_hp":
            amt = _coerce_positive_int(eff.get("amount"), 0)
            if amt <= 0:
                continue
            before = int(ch.cur_health)
            cap = int(ch.max_health)
            ch.cur_health = min(cap, before + amt)
            hp_gain += ch.cur_health - before
        elif kind == "restore_mana":
            amt = _coerce_positive_int(eff.get("amount"), 0)
            if amt <= 0:
                continue
            before = int(ch.cur_mana)
            cap = int(ch.max_mana)
            ch.cur_mana = min(cap, before + amt)
            mana_gain += ch.cur_mana - before
        elif kind == "dark_minimap_light":
            radius = _coerce_positive_int(eff.get("radius"), 0)
            additions = dark_minimap_light_additions(ch, radius)
            if additions:
                merged = _parse_dark_minimap_lit_ids(ch) | additions
                ch.dark_minimap_lit_room_ids = sorted(merged)
                msg = (eff.get("message") or "").strip()
                lines.append(msg or "The light reveals nearby passages.")

    if hp_gain > 0:
        lines.append(f"You recover {hp_gain} health.")
    if mana_gain > 0:
        lines.append(f"You recover {mana_gain} mana.")

    return lines
