"""Execute parsed QFF commands — returns message lines for the actor."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from qff.command_parser import (
    ParsedConsumeItem,
    ParsedDrop,
    ParsedEquip,
    ParsedGet,
    ParsedLookInspect,
    ParsedMove,
    ParsedSay,
    ParsedSearch,
    ParsedTalk,
    ParsedUnequip,
    ParsedUnknown,
    ParsedUse,
)
from qff.constants import SAY_MAX_LEN
from qff.exploration import mark_exit_used, on_enter_room, on_leave_room
from qff.exits import (
    consume_key_if_entering_locked,
    exit_is_passable,
    exit_is_visible_to_character,
)
from qff.game_helpers import (
    display_name_for_instance,
    format_item_inspect_parenthetical,
    item_meets_requirements,
    presence_threshold,
    roll_d100_plus_stat_encumbered,
    slot_field_for_item_slot,
)
from qff.models import Character, ItemInstance, RoomBroadcast, RoomExit
from qff.quest_engine import (
    ensure_quests_started_from_npc,
    find_interactable_in_room,
    find_npc_in_room,
    floor_item_visible_to_character,
    handle_interactable_use,
    resolve_npc_dialogue,
    try_item_transitions_on_talk,
)

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


def _instance_matches_query(inst: ItemInstance, q: str) -> bool:
    if not q:
        return False
    dn = display_name_for_instance(inst).lower()
    if dn == q:
        return True
    return dn.startswith(q) or q in dn


def _find_item_instance_floor_first(actor: CharacterType, query: str) -> ItemInstance | None:
    """Prefer floor, then inventory order, then equipped (get / look at item)."""
    from qff.models import ItemInstance as II

    q = (query or "").strip().lower()
    if not q:
        return None
    for inst in (
        II.objects.filter(room_id=actor.current_room_id, owner_character__isnull=True)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not floor_item_visible_to_character(actor, inst):
            continue
        if _instance_matches_query(inst, q):
            return inst
    for iid in actor.inventory or []:
        inst = (
            II.objects.filter(pk=iid, owner_character_id=actor.pk)
            .select_related("item")
            .first()
        )
        if inst and _instance_matches_query(inst, q):
            return inst
    for attr in SLOT_ATTRS:
        inst = getattr(actor, attr, None)
        if inst and _instance_matches_query(inst, q):
            return inst
    return None


def _find_item_instance_inventory_first(actor: CharacterType, query: str) -> ItemInstance | None:
    """Prefer backpack order, then equipped (drop / equip / consume from inv)."""
    from qff.models import ItemInstance as II

    q = (query or "").strip().lower()
    if not q:
        return None
    for iid in actor.inventory or []:
        inst = (
            II.objects.filter(pk=iid, owner_character_id=actor.pk)
            .select_related("item")
            .first()
        )
        if inst and _instance_matches_query(inst, q):
            return inst
    for attr in SLOT_ATTRS:
        inst = getattr(actor, attr, None)
        if inst and _instance_matches_query(inst, q):
            return inst
    return None


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


def _format_say_line(name: str, text: str) -> str:
    return f"{name} says: {text}"


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
        roll = roll_d100_plus_stat_encumbered(char, int(char.sense))
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

    if isinstance(parsed, ParsedConsumeItem):
        return _handle_consume_item(char, parsed)

    if isinstance(parsed, ParsedEquip):
        return _handle_equip(char, parsed.target)

    if isinstance(parsed, ParsedUnequip):
        return _handle_unequip(char, parsed.target)

    if isinstance(parsed, ParsedLookInspect):
        return _handle_look_inspect(char, parsed)

    if isinstance(parsed, ParsedTalk):
        return _handle_talk(char, parsed)

    if isinstance(parsed, ParsedUse):
        return _handle_use(char, parsed)

    return ["You try that, but nothing happens."]


def _handle_move(char: CharacterType, parsed: ParsedMove) -> list[str]:
    ex = (
        RoomExit.objects.select_related(
            "to_room",
            "quest_required_state",
            "key_item",
            "reveal_item",
            "reveal_quest_state",
        )
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
    if not exit_is_visible_to_character(char, ex):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way."]
    if not exit_is_passable(char, ex):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way — not yet."]
    if ex.lock_kind == RoomExit.LockKind.KEY:
        consume_key_if_entering_locked(char, ex)
        char = Character.objects.get(pk=char.pk)
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
    inst = _find_item_instance_inventory_first(char, target)
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
    inst = _find_item_instance_floor_first(char, target)
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
    inst = _find_item_instance_inventory_first(char, target)
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


def _handle_talk(char: CharacterType, parsed: ParsedTalk) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Talk to whom?"]
    npc = find_npc_in_room(char, target)
    if not npc:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't see them here."]
    ensure_quests_started_from_npc(char, npc)
    char = Character.objects.get(pk=char.pk)
    extra = try_item_transitions_on_talk(char, npc)
    char = Character.objects.get(pk=char.pk)
    main = resolve_npc_dialogue(char, npc)
    char.save(update_fields=["last_activity_at", "updated_at"])
    return extra + [main]


def _handle_use(char: CharacterType, parsed: ParsedUse) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [f"{parsed.verb.title()} what?"]
    if parsed.verb != "use":
        obj = find_interactable_in_room(char, target)
        if not obj:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't see that here."]
        lines = handle_interactable_use(char, obj)
        char = Character.objects.get(pk=char.pk)
        char.save(update_fields=["last_activity_at", "updated_at"])
        return lines

    obj = find_interactable_in_room(char, target)
    if obj:
        lines = handle_interactable_use(char, obj)
        char = Character.objects.get(pk=char.pk)
        char.save(update_fields=["last_activity_at", "updated_at"])
        return lines

    inst = _find_item_instance_inventory_first(char, target)
    inv = list(char.inventory or [])
    if inst and inst.pk in inv and inst.item.consumable:
        return _consume_inventory_instance(char, inst, "use")

    char.save(update_fields=["last_activity_at", "updated_at"])
    if inst and inst.pk in inv:
        return ["You can't use that."]
    return ["You don't see that here."]


def _handle_consume_item(char: CharacterType, parsed: ParsedConsumeItem) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        what = "Eat" if parsed.verb == "eat" else "Drink" if parsed.verb == "drink" else "Use"
        return [f"{what} what?"]
    inst = _find_item_instance_inventory_first(char, target)
    inv = list(char.inventory or [])
    if not inst or inst.pk not in inv:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    if not inst.item.consumable:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't consume that."]
    return _consume_inventory_instance(char, inst, parsed.verb)


def _consume_inventory_instance(
    char: CharacterType, inst: ItemInstance, verb: str
) -> list[str]:
    """Remove a consumable from inventory and destroy the instance."""
    from qff.models import ItemInstance as II

    label = display_name_for_instance(inst)
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        inst = II.objects.select_for_update().select_related("item").get(pk=inst.pk)
        inv = list(char.inventory or [])
        if inst.pk not in inv or not inst.item.consumable:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have that."]
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
        char.last_activity_at = timezone.now()
        char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
        inst.delete()

    v = verb.lower()
    if v == "eat":
        return [f"You eat the {label}."]
    if v == "drink":
        return [f"You drink the {label}."]
    return [f"You use the {label}."]


def _handle_look_inspect(char: CharacterType, parsed: ParsedLookInspect) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    target = (parsed.target or "").strip()
    if not target:
        return ["Look at what?"]

    npc = find_npc_in_room(char, target)
    if npc:
        base = (npc.description or "").strip() or f"You see {npc.name}."
        return [base]

    interactable = find_interactable_in_room(char, target)
    if interactable:
        t = (interactable.inspect_text or "").strip() or f"You see {interactable.name}."
        return [t]

    subj = _find_character_target(char, target)
    if subj:
        return _lines_for_character_inspect(char, subj, parsed.verb == "inspect")

    inst = _find_item_instance_floor_first(char, target)
    if inst:
        return _lines_for_item_inspect(char, inst)

    return ["You don't see that here."]


def _natural_join_phrases(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + ", and " + items[-1]


def _lines_for_character_inspect(
    actor: CharacterType, subj: CharacterType, is_inspect: bool
) -> list[str]:
    _ = is_inspect
    if not _visible_in_room(actor, subj):
        return ["You don't see that here."]
    wear_order = (
        subj.head_item,
        subj.chest_item,
        subj.feet_item,
        subj.ring_item,
        subj.amulet_item,
    )
    worn = [display_name_for_instance(x) for x in wear_order if x]
    mh_inst = subj.main_hand_item
    oh_inst = subj.off_hand_item
    mh_it = mh_inst.item if mh_inst else None
    two = mh_it.two_handed if mh_it else False

    parts: list[str] = []
    if worn:
        parts.append(f"They wear {_natural_join_phrases(worn)}.")
    if two and mh_inst:
        parts.append(f"They wield {display_name_for_instance(mh_inst)} (two-handed).")
    elif mh_inst and oh_inst:
        parts.append(
            f"They wield {display_name_for_instance(mh_inst)} and "
            f"{display_name_for_instance(oh_inst)}."
        )
    elif mh_inst:
        parts.append(f"They wield {display_name_for_instance(mh_inst)}.")
    elif oh_inst:
        parts.append(f"They wield {display_name_for_instance(oh_inst)}.")

    opener = f"{subj.name} is a level {subj.level} {subj.character_class.name}."
    if not parts:
        return [opener]
    return [opener + " " + " ".join(parts)]


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
            roll = roll_d100_plus_stat_encumbered(actor, int(actor.smarts))
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
