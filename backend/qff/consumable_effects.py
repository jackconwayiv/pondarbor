"""Apply Item.extra_data.consume_effects when a consumable is used."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from qff.models import Character, Item


def _coerce_positive_int(val: Any, default: int = 0) -> int:
    try:
        n = int(val)
        return n if n > 0 else default
    except (TypeError, ValueError):
        return default


def apply_consume_effects(character: "Character", item: "Item") -> list[str]:
    """Mutate character health/mana; return extra message lines (before consume copy)."""
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

    if hp_gain > 0:
        lines.append(f"You recover {hp_gain} health.")
    if mana_gain > 0:
        lines.append(f"You recover {mana_gain} mana.")

    return lines
