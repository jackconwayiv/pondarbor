"""Stats, item lookup, and rolls."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from qff.constants import PRESENCE_MINUTES
from qff.item_requirements import character_meets_glyph_requirements

if TYPE_CHECKING:
    from qff.models import Character, Item, ItemInstance  # noqa: F401 used in annotations


def load_inventory_instance_map(character: "Character") -> dict[int, "ItemInstance"]:
    """Single-query map of pk -> ItemInstance for the actor's owned inventory rows.

    Replaces per-id ``ItemInstance.objects.filter(pk=iid).first()`` loops in inventory
    walks (``_find_key_instance``, ``character_carries_item_template``, ``_find_item_instance_*``).
    Equipment slots are not included here; callers iterate ``SLOT_ATTRS`` against the
    already-hydrated Character instance.
    """
    from qff.models import ItemInstance

    ids = list(character.inventory or [])
    if not ids:
        return {}
    return {
        i.pk: i
        for i in ItemInstance.objects.filter(
            pk__in=ids, owner_character_id=character.pk
        ).select_related("item")
    }


def presence_threshold():
    from datetime import timedelta

    from django.utils import timezone

    return timezone.now() - timedelta(minutes=PRESENCE_MINUTES)


def peer_arrival_line(actor_name: str, travel_direction: str) -> str:
    """Observers in the destination room see this when someone enters along `travel_direction`."""
    from qff.models import RoomExit

    d = RoomExit.Direction
    opposite = {
        d.N: "south",
        d.S: "north",
        d.E: "west",
        d.W: "east",
        d.NW: "southeast",
        d.NE: "southwest",
        d.SW: "northeast",
        d.SE: "northwest",
    }
    if travel_direction in opposite:
        return f"{actor_name} enters from the {opposite[travel_direction]}."
    if travel_direction == d.UP:
        return f"{actor_name} enters from below."
    if travel_direction == d.DOWN:
        return f"{actor_name} enters from above."
    if travel_direction == d.IN:
        return f"{actor_name} enters from outside."
    if travel_direction == d.OUT:
        return f"{actor_name} enters from inside."
    return f"{actor_name} enters."


_EQUIP_SLOTS = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)


def _equipped_items(character: "Character"):
    for attr in _EQUIP_SLOTS:
        inst = getattr(character, attr, None)
        if inst is not None:
            yield inst


def total_armor_from_equipment(character: "Character") -> int:
    t = 0
    for inst in _equipped_items(character):
        t += int(inst.item.armor or 0)
    return t


def _hidden_stat_bonus_key(item: "Item") -> str | None:
    from qff.models import Item

    raw = (item.hidden_bonus_stat or "").strip()
    if not raw:
        return None
    valid = {c.value for c in Item.HiddenBonusStat if c.value}
    if raw not in valid:
        return None
    return raw


def stat_bonus_totals(character: "Character") -> dict:
    """Sum of equipment bonus_* only (modifiers from gear)."""
    from qff.models import Item

    t = {
        "gains": 0,
        "moves": 0,
        "guts": 0,
        "smarts": 0,
        "sense": 0,
        "rizz": 0,
    }
    for inst in _equipped_items(character):
        it: Item = inst.item
        t["gains"] += it.bonus_gains
        t["moves"] += it.bonus_moves
        t["guts"] += it.bonus_guts
        t["smarts"] += it.bonus_smarts
        t["sense"] += it.bonus_sense
        t["rizz"] += it.bonus_rizz
        hb = _hidden_stat_bonus_key(it)
        if hb is not None:
            t[hb] += int(it.hidden_bonus_value or 0)
    return t


def modified_stats(character: "Character") -> dict:
    """Base stats plus bonuses from equipped items."""
    from qff.models import Item

    b = {
        "gains": character.gains,
        "moves": character.moves,
        "guts": character.guts,
        "smarts": character.smarts,
        "sense": character.sense,
        "rizz": character.rizz,
    }
    for inst in _equipped_items(character):
        it: Item = inst.item
        b["gains"] += it.bonus_gains
        b["moves"] += it.bonus_moves
        b["guts"] += it.bonus_guts
        b["smarts"] += it.bonus_smarts
        b["sense"] += it.bonus_sense
        b["rizz"] += it.bonus_rizz
        hb = _hidden_stat_bonus_key(it)
        if hb is not None:
            b[hb] += int(it.hidden_bonus_value or 0)
    return b


def item_meets_requirements(character: "Character", item: "Item") -> bool:
    """Check base stats against item req_* (None/0 = no requirement)."""
    pairs = [
        (item.req_gains, character.gains),
        (item.req_moves, character.moves),
        (item.req_guts, character.guts),
        (item.req_smarts, character.smarts),
        (item.req_sense, character.sense),
        (item.req_rizz, character.rizz),
    ]
    for req, base in pairs:
        if req is not None and int(req) > 0 and base < int(req):
            return False
    if not character_meets_glyph_requirements(
        list(getattr(character, "glyphs", []) or []),
        list(getattr(item, "required_glyphs", []) or []),
        str(getattr(item, "required_glyphs_mode", "and") or "and"),
    ):
        return False
    return True


def item_instance_has_pending_lock_hint(
    inst: "ItemInstance", character: "Character | None" = None
) -> bool:
    """True when this instance still has roll-locked inspect content (lore / hidden lines)."""
    it = inst.item
    if it.lore_chance is None:
        return False
    if character is not None and character_knows_item_lore_for_template(character, it):
        return False
    return not inst.unlocked


def display_name_for_instance(
    inst: "ItemInstance",
    *,
    include_lock_hint: bool = False,
    character: "Character | None" = None,
) -> str:
    """(?) is only used for the play HUD (inventory + equipment). Pass True there only."""
    base = inst.nickname if inst.nickname else inst.item.name
    if include_lock_hint and item_instance_has_pending_lock_hint(inst, character):
        return f"{base} (?)"
    return base


def inventory_stack_label(
    inst: "ItemInstance", *, include_lock_hint: bool = False, character: "Character | None" = None
) -> str:
    """Display name with (N) suffix when quantity > 1."""
    base = display_name_for_instance(
        inst, include_lock_hint=include_lock_hint, character=character
    )
    q = int(getattr(inst, "quantity", 1) or 1)
    if q > 1:
        return f"{base} ({q})"
    return base


def roll_d100() -> int:
    return random.randint(1, 100)


_EQUIP_SLOTS_ENC = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)


def carried_item_instance_count(character: "Character") -> int:
    """Distinct item instances carried (inventory order + equipped)."""
    seen: set[int] = set()
    for iid in character.inventory or []:
        try:
            seen.add(int(iid))
        except (TypeError, ValueError):
            continue
    for attr in _EQUIP_SLOTS_ENC:
        inst = getattr(character, attr, None)
        if inst is not None:
            seen.add(inst.pk)
    return len(seen)


def inventory_distinct_instance_count(character: "Character") -> int:
    """Distinct item instances in inventory only (encumbrance ignores equipped)."""
    seen: set[int] = set()
    for iid in character.inventory or []:
        try:
            seen.add(int(iid))
        except (TypeError, ValueError):
            continue
    return len(seen)


def encumbrance_cap(character: "Character") -> int:
    return 5 + int(character.gains) // 10


def encumbrance_excess(character: "Character") -> int:
    return max(0, inventory_distinct_instance_count(character) - encumbrance_cap(character))


def character_knows_item_lore_for_template(character: "Character", item: "Item") -> bool:
    """True if this character has already unlocked lore for the item template (any instance)."""
    from qff.models import CharacterItemLoreUnlocked

    return CharacterItemLoreUnlocked.objects.filter(
        character_id=character.pk, item_id=item.pk
    ).exists()


def ensure_character_item_lore_template_unlocked(character: "Character", item: "Item") -> None:
    from qff.models import CharacterItemLoreUnlocked

    CharacterItemLoreUnlocked.objects.get_or_create(
        character_id=character.pk, item_id=item.pk
    )


def encumbrance_notice_if_hindered(character: "Character") -> list[str]:
    """Log line when this command used an encumbrance-penalized roll and excess is > 0."""
    if encumbrance_excess(character) > 0:
        return ["You are encumbered!"]
    return []


def roll_d100_plus_stat_encumbered(character: "Character", stat: int) -> int:
    """1d100 + stat − encumbrance excess (for search, inspect lore, etc.)."""
    return roll_d100() + int(stat) - encumbrance_excess(character)


def format_item_inspect_parenthetical(item: "Item", instance_unlocked: bool) -> str:
    """Short parenthetical of visible item stats; hidden lines only when lore is unlocked."""
    from qff.models import Item

    parts: list[str] = []
    pairs = [
        (item.bonus_gains, "Gains"),
        (item.bonus_moves, "Moves"),
        (item.bonus_guts, "Guts"),
        (item.bonus_smarts, "Smarts"),
        (item.bonus_sense, "Sense"),
        (item.bonus_rizz, "Rizz"),
    ]
    for v, label in pairs:
        iv = int(v or 0)
        if iv != 0:
            parts.append(f"{iv:+d} {label}")
    arm = int(item.armor or 0)
    if arm > 0:
        parts.append(f"+{arm} Armor")
    dmg = int(item.damage or 0)
    if dmg > 0:
        dt = item.get_dmg_type_display()
        parts.append(f"+{dmg} {dt.lower()} dmg")
    if instance_unlocked:
        hk = _hidden_stat_bonus_key(item)
        hv = int(item.hidden_bonus_value or 0)
        if hk is not None and hv != 0:
            parts.append(f"{hv:+d} {Item.HiddenBonusStat(hk).label}")
        if item.hidden_special_effect != Item.HiddenSpecialEffect.NONE:
            parts.append(item.get_hidden_special_effect_display())
    if not parts:
        return ""
    return " (" + ", ".join(parts) + ")"


def slot_field_for_item_slot(slot: str | None) -> str | None:
    from qff.models import Item

    if not slot:
        return None
    m = {
        Item.Slot.HEAD.value: "head_item",
        Item.Slot.MAIN_HAND.value: "main_hand_item",
        Item.Slot.OFF_HAND.value: "off_hand_item",
        Item.Slot.CHEST.value: "chest_item",
        Item.Slot.FEET.value: "feet_item",
        Item.Slot.RING.value: "ring_item",
        Item.Slot.AMULET.value: "amulet_item",
    }
    return m.get(slot)
