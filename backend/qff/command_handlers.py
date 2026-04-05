"""Execute parsed QFF commands — returns message lines for the actor."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from qff.command_parser import (
    ParsedDrop,
    ParsedEquip,
    ParsedGet,
    ParsedLookInspect,
    ParsedMove,
    ParsedSay,
    ParsedSearch,
    ParsedUnequip,
    ParsedUnknown,
)
from qff.constants import SAY_MAX_LEN
from qff.exploration import mark_exit_used, on_enter_room, on_leave_room
from qff.game_helpers import (
    display_name_for_instance,
    format_item_inspect_parenthetical,
    item_meets_requirements,
    presence_threshold,
    roll_d100,
    slot_field_for_item_slot,
)
from qff.models import Character, ItemInstance, RoomBroadcast, RoomExit

if TYPE_CHECKING:
    from qff.models import Character as CharacterType


SLOT_ATTRS = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)


def _touch_activity(char: CharacterType) -> None:
    char.last_activity_at = timezone.now()


def _others_present_count(char: CharacterType) -> int:
    return (
        Character.objects.filter(
            current_room_id=char.current_room_id,
            last_activity_at__gte=presence_threshold(),
        )
        .exclude(pk=char.pk)
        .count()
    )


def _visible_in_room(actor: CharacterType, other: CharacterType) -> bool:
    if other.current_room_id != actor.current_room_id:
        return False
    if other.pk == actor.pk:
        return True
    return other.last_activity_at >= presence_threshold()


def _find_character_target(actor: CharacterType, name_query: str) -> CharacterType | None:
    q = (name_query or "").strip().lower()
    if not q:
        return None
    others = Character.objects.filter(current_room_id=actor.current_room_id).select_related(
        "character_class"
    )
    for c in others.order_by("id"):
        if not _visible_in_room(actor, c):
            continue
        if c.name.lower() == q:
            return c
    for c in others.order_by("id"):
        if not _visible_in_room(actor, c):
            continue
        if c.name.lower().startswith(q):
            return c
    return None


def _collect_instances_for_lookup(actor: CharacterType) -> list[ItemInstance]:
    from qff.models import ItemInstance as II

    seen: set[int] = set()
    out: list[ItemInstance] = []
    for iid in actor.inventory or []:
        if iid in seen:
            continue
        inst = (
            II.objects.filter(pk=iid, owner_character_id=actor.pk)
            .select_related("item")
            .first()
        )
        if inst:
            seen.add(inst.pk)
            out.append(inst)
    for attr in SLOT_ATTRS:
        inst = getattr(actor, attr, None)
        if inst and inst.pk not in seen:
            seen.add(inst.pk)
            out.append(inst)
    out.extend(
        II.objects.filter(room_id=actor.current_room_id, owner_character__isnull=True)
        .select_related("item")
        .order_by("id")
    )
    return out


def _prepend_inv(inv, pk: int) -> list:
    """Inventory order: index 0 = most recently added."""
    cleaned = [x for x in (inv or []) if x != pk]
    return [pk] + cleaned


def _find_equipped_instance(
    char: CharacterType, query: str
) -> tuple[str | None, ItemInstance | None]:
    """First stable match among equipment slots only. Returns (slot_attr, instance)."""
    q = (query or "").strip().lower()
    if not q:
        return None, None
    for attr in SLOT_ATTRS:
        inst = getattr(char, attr, None)
        if not inst:
            continue
        if display_name_for_instance(inst).lower() == q:
            return attr, inst
    for attr in SLOT_ATTRS:
        inst = getattr(char, attr, None)
        if not inst:
            continue
        dn = display_name_for_instance(inst).lower()
        if dn.startswith(q) or q in dn:
            return attr, inst
    return None, None


def _find_item_instance(actor: CharacterType, query: str) -> ItemInstance | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    candidates = _collect_instances_for_lookup(actor)
    candidates.sort(key=lambda x: x.id)
    for inst in candidates:
        if display_name_for_instance(inst).lower() == q:
            return inst
    for inst in candidates:
        dn = display_name_for_instance(inst).lower()
        if dn.startswith(q) or q in dn:
            return inst
    return None


def _format_say_line(name: str, text: str) -> str:
    return f'({name}) says: "{text}"'


def execute_command(char: CharacterType, parsed) -> list[str]:
    """Mutates character state as needed; caller must reload or use returned session."""
    if isinstance(parsed, ParsedSay):
        _touch_activity(char)
        text = (parsed.text or "").strip()
        if not text:
            return []
        if _others_present_count(char) == 0:
            return []
        line = _format_say_line(char.name, text[:SAY_MAX_LEN])
        rb = RoomBroadcast.objects.create(
            room_id=char.current_room_id,
            speaker_id=char.pk,
            text=line,
        )
        char.last_room_broadcast_id = rb.id
        char.save(update_fields=["last_room_broadcast_id", "updated_at"])
        return [line]

    if isinstance(parsed, ParsedSearch):
        _touch_activity(char)
        char.save(update_fields=["last_activity_at", "updated_at"])
        room = char.current_room
        hidden = (room.search_text or "").strip()
        if not hidden:
            return [
                f"You spend some time searching the {room.name} but find nothing of note."
            ]
        roll = roll_d100() + int(char.sense)
        if roll >= int(room.search_chance):
            return [hidden]
        return [
            f"You spend some time searching the {room.name} but find nothing of note."
        ]

    if isinstance(parsed, ParsedUnknown):
        return ["You try that, but nothing happens."]

    if isinstance(parsed, ParsedMove):
        return _handle_move(char, parsed)

    if isinstance(parsed, ParsedDrop):
        return _handle_drop(char, parsed.target)

    if isinstance(parsed, ParsedGet):
        return _handle_get(char, parsed.target)

    if isinstance(parsed, ParsedEquip):
        return _handle_equip(char, parsed.target)

    if isinstance(parsed, ParsedUnequip):
        return _handle_unequip(char, parsed.target)

    if isinstance(parsed, ParsedLookInspect):
        return _handle_look_inspect(char, parsed)

    return ["You try that, but nothing happens."]


def _handle_move(char: CharacterType, parsed: ParsedMove) -> list[str]:
    ex = (
        RoomExit.objects.select_related("to_room")
        .filter(
            from_room=char.current_room,
            direction=parsed.direction,
        )
        .first()
    )
    _touch_activity(char)
    if not ex:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way."]
    if ex.is_hidden:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way."]
    if ex.lock_kind != RoomExit.LockKind.NONE:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way — not yet."]
    mark_exit_used(char, ex)
    left_room_id = char.current_room_id
    dest = ex.to_room
    char.current_room = dest
    char.save(update_fields=["current_room", "last_activity_at", "updated_at"])
    on_leave_room(left_room_id)
    on_enter_room(char, dest.id)
    return [f"You head {ex.get_direction_display().lower()}."]


def _handle_drop(char: CharacterType, target: str) -> list[str]:
    _touch_activity(char)
    inst = _find_item_instance(char, target)
    if not inst or inst.owner_character_id != char.pk:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    rid = char.current_room_id
    for attr in SLOT_ATTRS:
        cur = getattr(char, attr, None)
        if cur and cur.pk == inst.pk:
            setattr(char, attr, None)
            break
    inv = list(char.inventory or [])
    if inst.pk in inv:
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
    inst.room_id = rid
    inst.owner_character_id = None
    inst.neglect_count = 0
    inst.floor_dropped_at = timezone.now()
    inst.save(
        update_fields=[
            "room_id",
            "owner_character_id",
            "neglect_count",
            "floor_dropped_at",
            "updated_at",
        ]
    )
    char.save()
    return [f"You drop the {display_name_for_instance(inst)}."]


def _handle_get(char: CharacterType, target: str) -> list[str]:
    _touch_activity(char)
    inst = _find_item_instance(char, target)
    if not inst or inst.room_id != char.current_room_id or inst.owner_character_id is not None:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't see that here."]
    char.inventory = _prepend_inv(char.inventory, inst.pk)
    inst.room_id = None
    inst.owner_character_id = char.pk
    inst.neglect_count = 0
    inst.floor_dropped_at = None
    inst.save(
        update_fields=[
            "room_id",
            "owner_character_id",
            "neglect_count",
            "floor_dropped_at",
            "updated_at",
        ]
    )
    char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
    return [f"You pick up the {display_name_for_instance(inst)}."]


def _handle_equip(char: CharacterType, target: str) -> list[str]:
    _touch_activity(char)
    inst = _find_item_instance(char, target)
    if not inst or inst.owner_character_id != char.pk:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    if inst.room_id is not None:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    inv = list(char.inventory or [])
    if inst.pk not in inv:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["That isn't in your inventory."]
    it = inst.item
    if not item_meets_requirements(char, it):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You aren't skilled enough to use that yet."]
    slot_field = slot_field_for_item_slot(it.slot)
    if not slot_field:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't equip that."]
    if slot_field == "off_hand_item" and char.main_hand_item_id:
        mh = char.main_hand_item
        if mh and mh.item.two_handed:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You need both hands free for your main weapon."]

    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        inst = ItemInstance.objects.select_for_update().select_related("item").get(pk=inst.pk)
        it = inst.item
        inv = list(char.inventory or [])
        if inst.pk not in inv:
            return ["That isn't in your inventory."]
        # remove from inventory
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
        prev = getattr(char, slot_field, None)
        if it.two_handed and slot_field == "main_hand_item":
            off = char.off_hand_item
            if off:
                char.inventory = _prepend_inv(char.inventory, off.pk)
                char.off_hand_item = None
        if prev and prev.pk != inst.pk:
            char.inventory = _prepend_inv(char.inventory, prev.pk)
        setattr(char, slot_field, inst)
        if it.two_handed and slot_field == "main_hand_item":
            char.off_hand_item = None
        char.save()
    return [f"You equip the {display_name_for_instance(inst)}."]


def _handle_unequip(char: CharacterType, target: str) -> list[str]:
    _touch_activity(char)
    q = (target or "").strip()
    if not q:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Unequip what?"]
    slot_attr, inst = _find_equipped_instance(char, q)
    if not inst or not slot_attr:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that equipped."]
    setattr(char, slot_attr, None)
    char.inventory = _prepend_inv(char.inventory, inst.pk)
    char.save()
    return [f"You remove the {display_name_for_instance(inst)}."]


def _handle_look_inspect(char: CharacterType, parsed: ParsedLookInspect) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    target = (parsed.target or "").strip()
    if not target:
        return ["Look at what?"]

    subj = _find_character_target(char, target)
    if subj:
        return _lines_for_character_inspect(char, subj, parsed.verb == "inspect")

    inst = _find_item_instance(char, target)
    if inst:
        return _lines_for_item_inspect(char, inst)

    return ["You don't see that here."]


def _lines_for_character_inspect(
    actor: CharacterType, subj: CharacterType, is_inspect: bool
) -> list[str]:
    _ = is_inspect
    if not _visible_in_room(actor, subj):
        return ["You don't see that here."]
    chest = _slot_label(subj.chest_item)
    head = _slot_label(subj.head_item)
    feet = _slot_label(subj.feet_item)
    mh = _slot_label(subj.main_hand_item)
    oh = _slot_label(subj.off_hand_item)
    mh_it = subj.main_hand_item.item if subj.main_hand_item else None
    two = mh_it.two_handed if mh_it else False
    if two:
        wear = f"They wear {chest}, {head}, and {feet} and wield {mh} (two-handed)."
    else:
        off_phrase = f" and {oh}" if oh else ""
        wear = f"They wear {chest}, {head}, and {feet} and wield {mh}{off_phrase}."
    line = (
        f"{subj.name} is a level {subj.level} {subj.character_class.name}. "
        + wear
    )
    return [line]


def _slot_label(inst: ItemInstance | None) -> str:
    if inst is None:
        return "nothing"
    return display_name_for_instance(inst)


def _lines_for_item_inspect(actor: CharacterType, inst: ItemInstance) -> list[str]:
    it = inst.item
    base = (it.description or "").strip() or f"It is {it.name}."
    lore_extra = ""
    if it.lore_chance is None:
        if (it.lore or "").strip():
            lore_extra = " " + it.lore.strip()
        inst.unlocked = True
        inst.save(update_fields=["unlocked", "updated_at"])
    else:
        if inst.unlocked:
            if (it.lore or "").strip():
                lore_extra = " " + it.lore.strip()
        else:
            roll = roll_d100() + int(actor.smarts)
            if roll >= int(it.lore_chance):
                inst.unlocked = True
                inst.save(update_fields=["unlocked", "updated_at"])
                if (it.lore or "").strip():
                    lore_extra = " " + it.lore.strip()
            else:
                failed = list(inst.chars_failed_to_inspect or [])
                if actor.pk not in failed:
                    failed.append(actor.pk)
                    inst.chars_failed_to_inspect = failed
                    inst.save(update_fields=["chars_failed_to_inspect", "updated_at"])
    text = (base + lore_extra).strip()
    extra = format_item_inspect_parenthetical(it, inst.unlocked)
    if extra:
        text = text + extra
    return [text]
