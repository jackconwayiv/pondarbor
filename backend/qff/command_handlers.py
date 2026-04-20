"""Execute parsed QFF commands — returns message lines for the actor."""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from qff.command_parser import (
    ParsedAttack,
    ParsedBuyAbilities,
    ParsedConsumeItem,
    ParsedDrop,
    ParsedEquip,
    ParsedGet,
    ParsedLookDirection,
    ParsedLookInspect,
    ParsedMove,
    ParsedRead,
    ParsedSay,
    ParsedSearch,
    ParsedSell,
    ParsedShopBrowse,
    ParsedShopBuy,
    ParsedTalk,
    ParsedTrain,
    ParsedUnequip,
    ParsedUnknown,
    ParsedUse,
)
from qff.constants import COMBAT_ROUND_SECONDS, SAY_MAX_LEN, XP_PER_LEVEL
from qff.exploration import mark_exit_used, on_enter_room, on_leave_room
from qff.exits import (
    consume_key_if_entering_locked,
    exit_is_passable,
    exit_is_visible_to_character,
)
from qff.consumable_effects import apply_consume_effects, validate_consume_effects
from qff.game_helpers import (
    display_name_for_instance,
    format_item_inspect_parenthetical,
    inventory_stack_label,
    item_meets_requirements,
    peer_arrival_line,
    presence_threshold,
    roll_d100_plus_stat_encumbered,
    slot_field_for_item_slot,
)
from qff.inventory_absorb import absorb_item_quantity
from qff.models import (
    Character,
    Interactable,
    ItemInstance,
    MonsterInstance,
    Npc,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
    RoomItem,
)
from qff.quest_engine import (
    ensure_quests_started_from_npc,
    find_interactable_in_room,
    find_npc_in_room,
    floor_item_visible_to_character,
    handle_interactable_use,
    resolve_npc_dialogue,
    room_item_visible_to_character,
    sync_character_world_before_session,
    try_item_transitions_on_talk,
    unowned_floor_item_template_ids_in_room,
)
from qff.monster_sim import add_gold_to_room_floor
from qff.narrative_visibility import occupant_labels_for_look, room_is_narratively_visible
from qff.shop_engine import (
    browse_shop,
    find_inventory_instance,
    get_enabled_shops_in_room,
    purchase_from_shop,
    resolve_shop,
    sell_to_shop,
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


def _mark_command_boundary(char: CharacterType) -> None:
    now = timezone.now()
    Character.objects.filter(pk=char.pk).update(last_command_at=now, updated_at=now)
    char.last_command_at = now


def _find_monster_in_room(actor: CharacterType, query: str) -> MonsterInstance | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    # First match by id order wins (stable tie-break if several names contain the same token).
    for m in MonsterInstance.objects.filter(current_room_id=actor.current_room_id).select_related(
        "template"
    ).order_by("id"):
        name = m.template.name.lower()
        slug = m.template.slug.lower()
        slug_spaced = slug.replace("_", " ")
        word_match = any(
            part == q or part.startswith(q) for part in name.split() if part
        )
        if (
            name == q
            or slug == q
            or name.startswith(q)
            or slug.startswith(q)
            or q in name
            or q in slug_spaced
            or word_match
        ):
            return m
    return None


def _others_present_count(char: CharacterType) -> int:
    return (
        Character.objects.filter(
            current_room_id=char.current_room_id,
            last_activity_at__gte=presence_threshold(),
        )
        .exclude(pk=char.pk)
        .count()
    )


def _others_in_room(witness_room_id: int, exclude_character_pk: int) -> int:
    """Count other characters in `witness_room_id` (presence threshold), excluding one pk."""
    return (
        Character.objects.filter(
            current_room_id=witness_room_id,
            last_activity_at__gte=presence_threshold(),
        )
        .exclude(pk=exclude_character_pk)
        .count()
    )


def _interactable_observer_line(actor_name: str, verb: str, obj_name: str) -> str:
    v = (verb or "").lower()
    if v == "pull":
        return f"{actor_name} pulls the {obj_name}."
    if v == "push":
        return f"{actor_name} pushes the {obj_name}."
    if v == "open":
        return f"{actor_name} opens the {obj_name}."
    return f"{actor_name} uses the {obj_name}."


def _look_focus_peers(char: CharacterType, parsed: ParsedLookInspect, focus_phrase: str) -> None:
    vw = "examines" if parsed.verb == "inspect" else "looks at"
    _notify_peers_third_person(char, char.current_room_id, f"{char.name} {vw} {focus_phrase}.")


def _notify_peers_third_person(actor: CharacterType, witness_room_id: int, text: str) -> None:
    """Append a line to others' session action_log via RoomBroadcast; actor does not see it."""
    if _others_in_room(witness_room_id, actor.pk) == 0:
        return
    t = (text or "").strip()
    if not t:
        return
    rb = RoomBroadcast.objects.create(
        room_id=witness_room_id,
        speaker_id=actor.pk,
        text=t[:500],
    )
    Character.objects.filter(pk=actor.pk).update(
        last_room_broadcast_id=rb.id,
        updated_at=timezone.now(),
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


def _room_item_display_label(ri: RoomItem) -> str:
    return ri.nickname if ri.nickname else ri.item.name


def _room_item_matches_query(ri: RoomItem, q: str) -> bool:
    if not q:
        return False
    dn = _room_item_display_label(ri).lower()
    if dn == q:
        return True
    return dn.startswith(q) or q in dn


def _find_room_item(
    actor: CharacterType, query: str, floor_template_ids: set[int]
) -> RoomItem | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    for ri in (
        RoomItem.objects.filter(room_id=actor.current_room_id)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not room_item_visible_to_character(actor, ri, floor_template_ids):
            continue
        if _room_item_matches_query(ri, q):
            return ri
    return None


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


def _maybe_split_npc_prefix(
    shops: list,
    npc_query: str,
    item_query: str,
) -> tuple[str, str]:
    """If several shops in room and no npc hint, treat first word as NPC name when it matches."""
    npc_q = (npc_query or "").strip()
    item_q = (item_query or "").strip()
    if npc_q or len(shops) <= 1:
        return npc_q, item_q
    parts = item_q.split(None, 1)
    if len(parts) < 2:
        return npc_q, item_q
    w0, rest = parts[0], parts[1]
    w0l = w0.lower()
    for s in shops:
        n = s.npc
        if n.slug.lower() == w0l:
            return w0, rest
        nl = n.name.lower()
        if nl.startswith(w0l) or (n.name and nl.split()[0] == w0l):
            return w0, rest
    return npc_q, item_q


def _instance_is_equipped(char: CharacterType, inst_pk: int) -> bool:
    for attr in SLOT_ATTRS:
        inst = getattr(char, attr, None)
        if inst is not None and inst.pk == inst_pk:
            return True
    return False


def _handle_shop_browse(char: CharacterType, parsed: ParsedShopBrowse) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    npc_q = (parsed.npc_query or "").strip()
    shop, err = resolve_shop(char, npc_q)
    if err:
        return [err]
    return browse_shop(char, shop)


def _handle_shop_buy(char: CharacterType, parsed: ParsedShopBuy) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    item_q = (parsed.item_query or "").strip()
    npc_q = (parsed.npc_query or "").strip()
    if not item_q:
        shop, err = resolve_shop(char, npc_q)
        if err:
            return [err]
        return browse_shop(char, shop)
    shops = list(get_enabled_shops_in_room(char.current_room_id))
    npc_q, item_q = _maybe_split_npc_prefix(shops, npc_q, item_q)
    shop, err = resolve_shop(char, npc_q)
    if err:
        return [err]
    return purchase_from_shop(char, shop, item_q)


def _handle_shop_sell(char: CharacterType, parsed: ParsedSell) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    item_q = (parsed.item_query or "").strip()
    npc_q = (parsed.npc_query or "").strip()
    if not item_q:
        return ["Sell what?"]
    shops = list(get_enabled_shops_in_room(char.current_room_id))
    npc_q, item_q = _maybe_split_npc_prefix(shops, npc_q, item_q)
    shop, err = resolve_shop(char, npc_q)
    if err:
        return [err]
    char = Character.objects.select_related(
        "head_item",
        "main_hand_item",
        "off_hand_item",
        "chest_item",
        "feet_item",
        "ring_item",
        "amulet_item",
    ).get(pk=char.pk)
    inst = find_inventory_instance(char, item_q)
    if not inst:
        return ["You don't have that."]
    if _instance_is_equipped(char, inst.pk):
        return ["Unequip that first."]
    return sell_to_shop(char, shop, item_q)


def execute_command(
    char: CharacterType, parsed, *, world_sync: bool = True
) -> list[str]:
    """Mutates character state as needed; caller must reload or use returned session.

    When ``world_sync`` is False, the caller has already run
    :func:`~qff.quest_engine.sync_character_world_before_session` for this request
    (e.g. :func:`~qff.views.command_view`) to avoid duplicate DB work.
    """
    if world_sync:
        char = sync_character_world_before_session(char)

    if char.is_dead:
        return ["You are dead and cannot act."]

    if isinstance(parsed, ParsedUnknown):
        return ["You try that, but nothing happens."]

    if isinstance(parsed, ParsedSay):
        text = (parsed.text or "").strip()
        if not text:
            return []
        _mark_command_boundary(char)
        _touch_activity(char)
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

    _mark_command_boundary(char)

    if isinstance(parsed, ParsedShopBrowse):
        return _handle_shop_browse(char, parsed)

    if isinstance(parsed, ParsedShopBuy):
        return _handle_shop_buy(char, parsed)

    if isinstance(parsed, ParsedSell):
        return _handle_shop_sell(char, parsed)

    if isinstance(parsed, ParsedSearch):
        _touch_activity(char)
        char.save(update_fields=["last_activity_at", "updated_at"])
        _notify_peers_third_person(char, char.current_room_id, f"{char.name} is searching the area.")
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

    if isinstance(parsed, ParsedAttack):
        return _handle_attack(char, parsed)

    if isinstance(parsed, ParsedTrain):
        return _handle_train(char)

    if isinstance(parsed, ParsedBuyAbilities):
        return _handle_buy_abilities(char)

    if isinstance(parsed, ParsedMove):
        return _handle_move(char, parsed)

    if isinstance(parsed, ParsedDrop):
        return _handle_drop(char, parsed.target, parsed.quantity)

    if isinstance(parsed, ParsedGet):
        return _handle_get(char, parsed.target, parsed.quantity)

    if isinstance(parsed, ParsedConsumeItem):
        return _handle_consume_item(char, parsed)

    if isinstance(parsed, ParsedEquip):
        return _handle_equip(char, parsed.target)

    if isinstance(parsed, ParsedUnequip):
        return _handle_unequip(char, parsed.target)

    if isinstance(parsed, ParsedLookDirection):
        return _handle_look_direction(char, parsed)

    if isinstance(parsed, ParsedLookInspect):
        return _handle_look_inspect(char, parsed)

    if isinstance(parsed, ParsedRead):
        return _handle_read(char, parsed)

    if isinstance(parsed, ParsedTalk):
        return _handle_talk(char, parsed)

    if isinstance(parsed, ParsedUse):
        return _handle_use(char, parsed)

    return ["You try that, but nothing happens."]


def _handle_attack(char: CharacterType, parsed: ParsedAttack) -> list[str]:
    _touch_activity(char)
    q = (parsed.target or "").strip()
    if not q:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Attack what?"]
    m = _find_monster_in_room(char, q)
    if not m:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't see that here."]
    now = timezone.now()
    char.combat_target_monster_id = m.pk
    char.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
    char.save(
        update_fields=[
            "combat_target_monster",
            "next_action_at",
            "last_activity_at",
            "updated_at",
        ]
    )
    return ["You ready an attack."]


def _handle_buy_abilities(char: CharacterType) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    return [
        "Nobody here is selling ability scrolls yet. "
        "(Magic combat is still a stub — see qff.magic_combat.)"
    ]


def _handle_train(char: CharacterType) -> list[str]:
    _touch_activity(char)
    trainer = Npc.objects.filter(room_id=char.current_room_id, is_trainer=True).first()
    if not trainer:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["There is no trainer here."]
    need = int(char.level) * XP_PER_LEVEL
    if int(char.xp) < need:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [
            f"You need at least {need} XP to train further. (You have {char.xp}.)"
        ]
    char.level = int(char.level) + 1
    char.unspent_stat_points = int(char.unspent_stat_points or 0) + 3
    char.save(
        update_fields=[
            "level",
            "unspent_stat_points",
            "last_activity_at",
            "updated_at",
        ]
    )
    return [
        f"You train with {trainer.name} and advance to level {char.level}! "
        f"You have {char.unspent_stat_points} unspent stat points."
    ]


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
    dir_label = ex.get_direction_display().lower()
    _notify_peers_third_person(char, left_room_id, f"{char.name} heads {dir_label}.")
    char.current_room = dest
    char.save(update_fields=["current_room", "last_activity_at", "updated_at"])
    on_leave_room(left_room_id)
    on_enter_room(char, dest.id)
    _notify_peers_third_person(char, dest.id, peer_arrival_line(char.name, ex.direction))

    from qff.monster_sim import (
        engage_monsters_for_new_arrivals,
        monsters_follow_hero_move,
        on_spawn_room_enter,
        safe_room_disengage,
        sense_adjacent_monsters,
    )

    messages = [f"You head {dir_label}."]
    dest_room = dest
    on_spawn_room_enter(char, dest_room)

    if safe_room_disengage(char, dest_room):
        messages.append("You feel safer here.")
    elif not dest_room.is_safe and char.next_action_at:
        char.next_action_at = timezone.now() + timedelta(seconds=COMBAT_ROUND_SECONDS)
        char.save(update_fields=["next_action_at", "updated_at"])

    monsters_follow_hero_move(char, left_room_id, dest.id)
    sense_adjacent_monsters(char, dest.id)
    engage_monsters_for_new_arrivals(char, dest.id)

    return messages


def _handle_drop_gold(char: CharacterType, want_qty: int | None) -> list[str]:
    """Drop gold from wallet onto the room floor (``want_qty`` None = all gold)."""
    rid = char.current_room_id
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        wallet = int(char.gold or 0)
        if wallet <= 0:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have any gold."]
        drop_amt = wallet if want_qty is None else min(int(want_qty), wallet)
        if drop_amt <= 0:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["Drop how many?"]
        char.gold = wallet - drop_amt
        char.last_activity_at = timezone.now()
        char.save(update_fields=["gold", "last_activity_at", "updated_at"])
    add_gold_to_room_floor(rid, drop_amt)
    char = Character.objects.get(pk=char.pk)
    _notify_peers_third_person(char, rid, f"{char.name} drops {drop_amt} gold.")
    return [f"You drop {drop_amt} gold."]


def _handle_drop(
    char: CharacterType, target: str, want_qty: int | None = None
) -> list[str]:
    _touch_activity(char)
    q = (target or "").strip()
    if not q:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Drop what?"]
    if want_qty is not None and want_qty < 1:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Drop how many?"]

    t = (target or "").strip().lower()
    if _wants_floor_gold_take(target) or (
        want_qty is not None
        and t in ("gold", "coins", "coin", "money", "pile")
    ):
        return _handle_drop_gold(char, want_qty)

    inst = _find_item_instance_inventory_first(char, q)
    if not inst or inst.owner_character_id != char.pk:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    rid = char.current_room_id
    held = max(1, int(inst.quantity or 1))
    inv = list(char.inventory or [])
    in_inv = inst.pk in inv
    equipped_attr: str | None = None
    for attr in SLOT_ATTRS:
        cur = getattr(char, attr, None)
        if cur and cur.pk == inst.pk:
            equipped_attr = attr
            break

    if want_qty is not None:
        if want_qty > held:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have that many."]
        if not inst.item.stackable and want_qty > 1:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You can't split that stack."]
        if equipped_attr is not None and want_qty < held:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["Unequip that first if you want to drop only some."]

    drop_qty = held if want_qty is None else want_qty

    if drop_qty < held:
        floor_label = ""
        with transaction.atomic():
            char = Character.objects.select_for_update().get(pk=char.pk)
            inst = ItemInstance.objects.select_for_update().select_related("item").get(
                pk=inst.pk
            )
            inv2 = list(char.inventory or [])
            if inst.pk not in inv2 or inst.owner_character_id != char.pk:
                char.save(update_fields=["last_activity_at", "updated_at"])
                return ["You don't have that."]
            held2 = max(1, int(inst.quantity or 1))
            inst.quantity = held2 - drop_qty
            inst.save(update_fields=["quantity", "updated_at"])
            floor_inst = ItemInstance.objects.create(
                item_id=inst.item_id,
                quantity=drop_qty,
                room_id=rid,
                owner_character=None,
                nickname=inst.nickname,
                unlocked=inst.unlocked,
                chars_failed_to_inspect=list(inst.chars_failed_to_inspect or []),
                neglect_count=0,
                floor_dropped_at=timezone.now(),
                visible_quest_state_id=None,
            )
            char.last_activity_at = timezone.now()
            char.save(update_fields=["last_activity_at", "updated_at"])
            floor_label = inventory_stack_label(floor_inst)
        char = Character.objects.get(pk=char.pk)
        _notify_peers_third_person(char, rid, f"{char.name} drops the {floor_label}.")
        return [f"You drop the {floor_label}."]

    for attr in SLOT_ATTRS:
        cur = getattr(char, attr, None)
        if cur and cur.pk == inst.pk:
            setattr(char, attr, None)
            break
    if inst.pk in inv:
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
    inst.room_id = rid
    inst.owner_character_id = None
    inst.neglect_count = 0
    inst.floor_dropped_at = timezone.now()
    # Player-dropped items should be visible to everyone in the room; clear any
    # quest gate copied from a DM floor spawn or still set on the instance.
    inst.visible_quest_state_id = None
    inst.save(
        update_fields=[
            "room_id",
            "owner_character_id",
            "neglect_count",
            "floor_dropped_at",
            "visible_quest_state_id",
            "updated_at",
        ]
    )
    char.save()
    label = inventory_stack_label(inst)
    _notify_peers_third_person(char, rid, f"{char.name} drops the {label}.")
    return [f"You drop the {label}."]


def _wants_floor_gold_take(target: str) -> bool:
    q = (target or "").strip().lower()
    if not q:
        return True
    return q in ("gold", "coins", "coin", "money", "pile")


def _handle_take_floor_gold(char: CharacterType, want_qty: int | None) -> list[str]:
    """Take all floor gold (``want_qty`` None) or up to ``want_qty`` (capped by available)."""
    rid = char.current_room_id
    _touch_activity(char)
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        piles = list(
            RoomGoldPile.objects.filter(room_id=rid, amount_remaining__gt=0)
            .select_for_update()
            .order_by("id")
        )
        if not piles:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't see that here."]
        total_floor = sum(int(p.amount_remaining) for p in piles)
        take_amt = total_floor if want_qty is None else min(int(want_qty), total_floor)
        if take_amt <= 0:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't see that here."]
        char.gold = int(char.gold or 0) + take_amt
        char.last_activity_at = timezone.now()
        char.save(update_fields=["gold", "last_activity_at", "updated_at"])
        left = take_amt
        for p in piles:
            if left <= 0:
                break
            v = int(p.amount_remaining)
            use = min(v, left)
            left -= use
            nv = v - use
            if nv <= 0:
                RoomGoldPile.objects.filter(pk=p.pk).delete()
            else:
                RoomGoldPile.objects.filter(pk=p.pk).update(amount_remaining=nv)
    char = Character.objects.get(pk=char.pk)
    _notify_peers_third_person(
        char, char.current_room_id, f"{char.name} scoops up {take_amt} gold."
    )
    return [f"You pick up {take_amt} gold."]


def _handle_get(
    char: CharacterType, target: str, want_qty: int | None = None
) -> list[str]:
    t = (target or "").strip().lower()
    if _wants_floor_gold_take(target) or (
        want_qty is not None
        and t in ("gold", "coins", "coin", "money", "pile")
    ):
        return _handle_take_floor_gold(char, want_qty)

    _touch_activity(char)

    inst = _find_item_instance_floor_first(char, target)
    if inst and inst.room_id == char.current_room_id and inst.owner_character_id is None:
        pickup_label = inventory_stack_label(inst)
        donor_qty = max(1, int(inst.quantity or 1))
        with transaction.atomic():
            char = Character.objects.select_for_update().get(pk=char.pk)
            inst = (
                ItemInstance.objects.select_for_update()
                .select_related("item")
                .get(pk=inst.pk)
            )
            if inst.room_id != char.current_room_id or inst.owner_character_id is not None:
                char.save(update_fields=["last_activity_at", "updated_at"])
                return ["You don't see that here."]
            item = inst.item
            new_pks = absorb_item_quantity(char, item, donor_qty, donor=inst)
            inst.delete()
            for pk in reversed(new_pks):
                char.inventory = _prepend_inv(char.inventory, pk)
            char.last_activity_at = timezone.now()
            char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
        char = Character.objects.get(pk=char.pk)
        _notify_peers_third_person(
            char, char.current_room_id, f"{char.name} takes the {pickup_label}."
        )
        return [f"You pick up the {pickup_label}."]

    floor_ids = unowned_floor_item_template_ids_in_room(char.current_room_id)
    ri = _find_room_item(char, target, floor_ids)
    if not ri:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't see that here."]
    pickup_name = ri.nickname if ri.nickname else ri.item.name
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        ri = RoomItem.objects.select_related("item", "visible_quest_state").get(pk=ri.pk)
        floor_ids_locked = unowned_floor_item_template_ids_in_room(char.current_room_id)
        if not room_item_visible_to_character(char, ri, floor_ids_locked):
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't see that here."]
        new_pks = absorb_item_quantity(char, ri.item, 1, donor=None)
        for pk in reversed(new_pks):
            char.inventory = _prepend_inv(char.inventory, pk)
        char.last_activity_at = timezone.now()
        char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
    char = Character.objects.get(pk=char.pk)
    _notify_peers_third_person(
        char, char.current_room_id, f"{char.name} takes the {pickup_name}."
    )
    return [f"You pick up the {pickup_name}."]


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
    label = display_name_for_instance(inst)
    _notify_peers_third_person(char, char.current_room_id, f"{char.name} equips the {label}.")
    return [f"You equip the {label}."]


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
    label = display_name_for_instance(inst)
    _notify_peers_third_person(char, char.current_room_id, f"{char.name} removes the {label}.")
    return [f"You remove the {label}."]


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
    _notify_peers_third_person(char, char.current_room_id, f"{char.name} is talking to {npc.name}.")
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
        _notify_peers_third_person(
            char,
            char.current_room_id,
            _interactable_observer_line(char.name, parsed.verb, obj.name),
        )
        return lines

    obj = find_interactable_in_room(char, target)
    if obj:
        lines = handle_interactable_use(char, obj)
        char = Character.objects.get(pk=char.pk)
        char.save(update_fields=["last_activity_at", "updated_at"])
        _notify_peers_third_person(
            char,
            char.current_room_id,
            _interactable_observer_line(char.name, parsed.verb, obj.name),
        )
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
    """Remove one consumable from a stack (or destroy the instance)."""
    from qff.models import ItemInstance as II

    room_id = char.current_room_id
    actor_name = char.name
    actor_pk = char.pk
    effect_lines: list[str] = []
    base_label = ""
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        inst = II.objects.select_for_update().select_related("item").get(pk=inst.pk)
        inv = list(char.inventory or [])
        if inst.pk not in inv or not inst.item.consumable:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have that."]
        err = validate_consume_effects(char, inst.item)
        if err:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return [err]
        base_label = display_name_for_instance(inst)
        effect_lines = apply_consume_effects(char, inst.item)
        qty = max(1, int(inst.quantity or 1))
        char.last_activity_at = timezone.now()
        if qty > 1:
            inst.quantity = qty - 1
            inst.save(update_fields=["quantity", "updated_at"])
            char.save(
                update_fields=[
                    "cur_health",
                    "cur_mana",
                    "dark_minimap_lit_room_ids",
                    "last_activity_at",
                    "updated_at",
                ]
            )
        else:
            inv = [x for x in inv if x != inst.pk]
            char.inventory = inv
            inst.delete()
            char.save(
                update_fields=[
                    "inventory",
                    "cur_health",
                    "cur_mana",
                    "dark_minimap_lit_room_ids",
                    "last_activity_at",
                    "updated_at",
                ]
            )

    ch = Character.objects.get(pk=actor_pk)
    v = verb.lower()
    if v == "eat":
        _notify_peers_third_person(ch, room_id, f"{actor_name} eats the {base_label}.")
        return [f"You eat the {base_label}."] + effect_lines
    if v == "drink":
        _notify_peers_third_person(ch, room_id, f"{actor_name} drinks the {base_label}.")
        return [f"You drink the {base_label}."] + effect_lines
    _notify_peers_third_person(ch, room_id, f"{actor_name} uses the {base_label}.")
    return [f"You use the {base_label}."] + effect_lines


def _handle_read(char: CharacterType, parsed: ParsedRead) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Read what?"]
    obj = find_interactable_in_room(char, target)
    if not obj:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't see that here."]
    text = (obj.read_text or "").strip() or (obj.inspect_text or "").strip()
    if not text:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["There is nothing to read."]
    _notify_peers_third_person(char, char.current_room_id, f"{char.name} reads the {obj.name}.")
    char.save(update_fields=["last_activity_at", "updated_at"])
    return [text]


def _handle_look_direction(char: CharacterType, parsed: ParsedLookDirection) -> list[str]:
    """look e / look north — describe the exit when visible, non-hidden, and unlocked."""
    ex = (
        RoomExit.objects.filter(
            from_room_id=char.current_room_id,
            direction=parsed.direction,
        )
        .select_related("to_room")
        .first()
    )
    if (
        ex
        and exit_is_visible_to_character(char, ex)
        and not ex.is_hidden
        and ex.lock_kind == RoomExit.LockKind.NONE
    ):
        _touch_activity(char)
        char.save(update_fields=["last_activity_at", "updated_at"])
        dest = ex.to_room
        if not room_is_narratively_visible(char, dest):
            return ["It's too dark to see!"]
        dir_label = ex.get_direction_display().lower()
        name = (dest.name or "").strip() or "somewhere"
        line = f"To the {dir_label}, {name} lies ahead."
        out = [line]
        labels = occupant_labels_for_look(char, dest.id)
        if labels:
            out.append(f"You make out: {_natural_join_phrases(labels)}.")
        return out
    return _handle_look_inspect(
        char,
        ParsedLookInspect(verb=parsed.verb, target=parsed.original_token),
    )


def _handle_look_inspect(char: CharacterType, parsed: ParsedLookInspect) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    target = (parsed.target or "").strip()
    if not target:
        room = char.current_room
        if not room_is_narratively_visible(char, room):
            return ["This area is too dark to see."]
        rname = (room.name or "").strip() or "here"
        out = [rname + "."]
        labels = occupant_labels_for_look(char, room.id)
        if labels:
            out.append(f"You make out: {_natural_join_phrases(labels)}.")
        return out

    npc = find_npc_in_room(char, target)
    if npc:
        _look_focus_peers(char, parsed, npc.name)
        base = (npc.description or "").strip() or f"You see {npc.name}."
        return [base]

    interactable = find_interactable_in_room(char, target)
    if interactable:
        _look_focus_peers(char, parsed, interactable.name)
        t = (interactable.inspect_text or "").strip() or f"You see {interactable.name}."
        out = [t]
        if interactable.kind in (
            Interactable.Kind.CHEST,
            Interactable.Kind.BARREL,
            Interactable.Kind.CRATE,
            Interactable.Kind.SACK,
        ):
            floor_ids = unowned_floor_item_template_ids_in_room(char.current_room_id)
            inside: list[str] = []
            for inst in ItemInstance.objects.filter(
                room_id=char.current_room_id,
                container_interactable_id=interactable.pk,
                owner_character__isnull=True,
            ).select_related("item", "visible_quest_state"):
                if floor_item_visible_to_character(char, inst):
                    inside.append(display_name_for_instance(inst))
            for ri in RoomItem.objects.filter(
                room_id=char.current_room_id,
                interactable_id=interactable.pk,
            ).select_related("item", "visible_quest_state"):
                if room_item_visible_to_character(char, ri, floor_ids):
                    inside.append(_room_item_display_label(ri))
            if inside:
                out.append(f"Inside: {_natural_join_phrases(inside)}.")
        return out

    monster = _find_monster_in_room(char, target)
    if monster:
        _look_focus_peers(char, parsed, monster.template.name)
        tpl = monster.template
        base = (tpl.description or "").strip() or f"You see the {tpl.name}."
        if parsed.verb == "inspect" and (tpl.hidden_description or "").strip():
            return [base, (tpl.hidden_description or "").strip()]
        return [base]

    subj = _find_character_target(char, target)
    if subj:
        _look_focus_peers(char, parsed, subj.name)
        return _lines_for_character_inspect(char, subj, parsed.verb == "inspect")

    inst = _find_item_instance_floor_first(char, target)
    if inst:
        _look_focus_peers(char, parsed, f"the {display_name_for_instance(inst)}")
        return _lines_for_item_inspect(char, inst)

    floor_ids = unowned_floor_item_template_ids_in_room(char.current_room_id)
    ri = _find_room_item(char, target, floor_ids)
    if ri:
        _look_focus_peers(char, parsed, f"the {_room_item_display_label(ri)}")
        it = ri.item
        base = (it.description or "").strip() or f"It is {it.name}."
        extra = format_item_inspect_parenthetical(it, False)
        text = (base + extra).strip()
        return [text]

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
