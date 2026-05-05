"""Execute parsed QFF commands — returns message lines for the actor."""

from __future__ import annotations

import logging
import time
from contextvars import ContextVar
from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from qff.command_parser import (
    ParsedActiveQuests,
    ParsedAttack,
    ParsedBuyAbilities,
    ParsedConsumeItem,
    ParsedDrop,
    ParsedEmote,
    ParsedEquip,
    ParsedGet,
    ParsedLeave,
    ParsedLookDirection,
    ParsedLookInspect,
    ParsedMove,
    ParsedOpenContainer,
    ParsedPut,
    ParsedRead,
    ParsedRestSleep,
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
from qff.constants import (
    COMBAT_ROUND_SECONDS,
    NARRATIVE_TOO_DARK_MESSAGE,
    SAY_MAX_LEN,
    XP_PER_LEVEL,
)
from qff.exploration import mark_exit_used, on_enter_room, on_leave_room
from qff.glyph_class_map import normalize_glyph
from qff.exits import (
    build_exit_evaluation_context,
    consume_key_if_entering_locked,
    exit_is_passable,
    exit_is_visible_to_character,
)
from qff.consumable_effects import (
    apply_consume_effects,
    consume_effects_contain_teleport_spawn,
    refresh_torch_lit_from_hero_position,
    validate_consume_effects,
)
from qff.game_helpers import (
    character_knows_item_lore_for_template,
    display_name_for_instance,
    encumbrance_notice_if_hindered,
    ensure_character_item_lore_template_unlocked,
    format_item_inspect_parenthetical,
    inventory_stack_label,
    item_meets_requirements,
    load_inventory_instance_map,
    modified_stats,
    peer_arrival_line,
    presence_threshold,
    roll_d100_plus_stat_encumbered,
    slot_field_for_item_slot,
)
from qff.inventory_absorb import absorb_item_quantity
from qff.models import (
    Character,
    CharacterExitSeen,
    CharacterRoomSearchClaim,
    Interactable,
    Item,
    ItemInstance,
    MonsterInstance,
    Npc,
    NpcShop,
    NpcShopStockLine,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
    RoomItem,
    RoomItemCharacterClaim,
    RoomItemSpawn,
)
from qff.quest_engine import (
    build_room_item_visibility_batch,
    can_spawn_search_quest_floor_item,
    ensure_quests_started_from_npc,
    find_interactable_in_room,
    find_npc_in_room,
    find_other_hero_in_room,
    floor_item_visible_to_character,
    handle_interactable_use,
    resolve_npc_dialogue,
    room_item_visible_to_character,
    sync_character_world_before_session,
    try_item_transitions_on_talk,
    unowned_floor_item_template_ids_in_room,
)
from qff.monster_sim import (
    _disengage_monsters_from_hero,
    add_gold_to_room_floor,
    ensure_monster_engaged_by_attacker,
)
from qff.realm_presence import broadcast_realm_depart

# Max RoomBroadcast.id immediately before engage_monsters (move/teleport); command_view
# reads via consume_action_log_pre_engagement_cutover() to order action_log.
_action_log_pre_engagement_max_id: ContextVar[int | None] = ContextVar(
    "qff_action_log_pre_engagement_max_id", default=None
)


def consume_action_log_pre_engagement_cutover() -> int | None:
    """Return and clear cutover id for splitting exec-phase action_log (see command_view)."""
    v = _action_log_pre_engagement_max_id.get()
    _action_log_pre_engagement_max_id.set(None)
    return v


def _engage_monsters_after_arrival(hero: Character, dest_room_id: int) -> None:
    """Run monster engagement hooks; record RoomBroadcast id cutover for action_log ordering."""
    from qff.monster_sim import engage_monsters_for_new_arrivals

    max_id = RoomBroadcast.objects.aggregate(m=Max("id"))["m"] or 0
    _action_log_pre_engagement_max_id.set(max_id)
    engage_monsters_for_new_arrivals(hero, dest_room_id)
from qff.narrative_visibility import occupant_labels_for_look, room_is_narratively_visible
from qff.shop_engine import (
    browse_shop,
    find_any_shop_line_in_room,
    find_inventory_instance,
    get_enabled_shops_in_room,
    purchase_from_shop,
    resolve_shop,
    sell_to_shop,
)
from qff.static_cache import get_room_exits_from_room

if TYPE_CHECKING:
    from qff.models import Character as CharacterType

logger = logging.getLogger(__name__)

SLOT_ATTRS = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)

_ALIEN_GLYPH = normalize_glyph("👽")


def _character_has_alien_glyph(char: CharacterType) -> bool:
    for g in char.glyphs or []:
        if normalize_glyph(str(g)) == _ALIEN_GLYPH:
            return True
    return False


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
    for m in MonsterInstance.objects.filter(
        current_room_id=actor.current_room_id,
        cur_hp__gt=0,
    ).select_related("template").order_by("id"):
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
            is_in_realm=True,
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
            is_in_realm=True,
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
        scope=RoomBroadcast.Scope.ROOM,
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
    if not getattr(other, "is_in_realm", True):
        return False
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


def _find_room_item(actor: CharacterType, query: str) -> RoomItem | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    room_items = list(
        RoomItem.objects.filter(room_id=actor.current_room_id)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    )
    visibility_batch = build_room_item_visibility_batch(
        actor, actor.current_room_id, room_items
    )
    for ri in room_items:
        if not room_item_visible_to_character(actor, ri, visibility_batch):
            continue
        if _room_item_matches_query(ri, q):
            return ri
    return None


def _find_item_instance_floor_first(actor: CharacterType, query: str) -> ItemInstance | None:
    """Prefer opened-container floor loot, then other floor, then inventory, then equipped."""
    from qff.models import ItemInstance as II

    q = (query or "").strip().lower()
    if not q:
        return None
    cid = getattr(actor, "opened_container_interactable_id", None)
    if cid:
        for inst in (
            II.objects.filter(
                room_id=actor.current_room_id,
                owner_character__isnull=True,
                container_interactable_id=cid,
            )
            .select_related("item", "visible_quest_state")
            .order_by("id")
        ):
            if not floor_item_visible_to_character(actor, inst):
                continue
            if _instance_matches_query(inst, q):
                return inst
    for inst in (
        II.objects.filter(room_id=actor.current_room_id, owner_character__isnull=True)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if cid and inst.container_interactable_id == cid:
            continue
        if not floor_item_visible_to_character(actor, inst):
            continue
        if _instance_matches_query(inst, q):
            return inst
    inv_map = load_inventory_instance_map(actor)
    for iid in actor.inventory or []:
        inst = inv_map.get(iid)
        if inst and _instance_matches_query(inst, q):
            return inst
    for attr in SLOT_ATTRS:
        inst = getattr(actor, attr, None)
        if inst and _instance_matches_query(inst, q):
            return inst
    return None


def _find_item_instance_inventory_first(actor: CharacterType, query: str) -> ItemInstance | None:
    """Prefer backpack order, then equipped (drop / equip / consume from inv)."""
    q = (query or "").strip().lower()
    if not q:
        return None
    inv_map = load_inventory_instance_map(actor)
    for iid in actor.inventory or []:
        inst = inv_map.get(iid)
        if inst and _instance_matches_query(inst, q):
            return inst
    for attr in SLOT_ATTRS:
        inst = getattr(actor, attr, None)
        if inst and _instance_matches_query(inst, q):
            return inst
    return None


def _inventory_consumable_candidates(
    char: CharacterType, query: str
) -> list[ItemInstance]:
    """Inventory then equipped, all consumables matching ``query`` (same walk order as inventory-first)."""
    q = (query or "").strip().lower()
    if not q:
        return []
    out: list[ItemInstance] = []
    inv_map = load_inventory_instance_map(char)
    for iid in char.inventory or []:
        inst = inv_map.get(iid)
        if inst and inst.item.consumable and _instance_matches_query(inst, q):
            out.append(inst)
    for attr in SLOT_ATTRS:
        inst = getattr(char, attr, None)
        if inst and inst.item.consumable and _instance_matches_query(inst, q):
            out.append(inst)
    return out


def _pick_single_consumable_candidate(
    candidates: list[ItemInstance], query: str
) -> ItemInstance | None:
    q = (query or "").strip().lower()
    if not candidates:
        return None
    exact = [
        i for i in candidates if display_name_for_instance(i).lower() == q
    ]
    if len(exact) == 1:
        return exact[0]
    if len(candidates) == 1:
        return candidates[0]
    return None


def _consumable_matches_inventory_verb(item, attempted_verb: str) -> bool:
    """Blank ``consume_verb`` = any; otherwise inventory consume must match that verb."""
    req = (getattr(item, "consume_verb", None) or "").strip().lower()
    if not req:
        return True
    return req == (attempted_verb or "").strip().lower()


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


def _handle_active_quests(char: CharacterType) -> list[str]:
    _touch_activity(char)
    char.save(update_fields=["last_activity_at", "updated_at"])
    return []


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
    sell_all = bool(getattr(parsed, "sell_all", False))
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
    return sell_to_shop(char, shop, item_q, sell_all=sell_all)


def execute_command(
    char: CharacterType, parsed, *, world_sync: bool = True
) -> list[str]:
    """Mutates character state as needed; caller must reload or use returned session.

    When ``world_sync`` is False, the caller has already run
    :func:`~qff.quest_engine.sync_character_world_before_session` for this request
    (e.g. :func:`~qff.views.command_view`) to avoid duplicate DB work. With
    ``world_sync`` True the row is re-fetched (with the same select_related shape
    as ``views._get_character``) so callers passing a long-lived in-memory row
    (e.g. tests) see fresh DB state.
    """
    if world_sync:
        char = (
            Character.objects.select_related(
                "character_class",
                "current_room",
                "current_room__area",
                "spawn_room",
                "head_item__item",
                "main_hand_item__item",
                "off_hand_item__item",
                "chest_item__item",
                "feet_item__item",
                "ring_item__item",
                "amulet_item__item",
            )
            .get(pk=char.pk)
        )
        sync_character_world_before_session(char)

    if char.is_dead:
        return ["You are dead and cannot act."]

    if not char.is_in_realm:
        if isinstance(parsed, ParsedLeave):
            return ["You are already out of the realm."]
        return ["You are not currently in the realm. Enter play to act."]

    if isinstance(parsed, ParsedUnknown):
        return ["You try that, but nothing happens."]

    if isinstance(parsed, ParsedLeave):
        _mark_command_boundary(char)
        return _handle_leave(char)

    cancel_prefix: list[str] = []
    if char.pending_leave_at is not None:
        char.pending_leave_at = None
        char.save(update_fields=["pending_leave_at", "updated_at"])
        cancel_prefix = ["You abort your escape."]

    result = _dispatch_non_leave(char, parsed)
    return cancel_prefix + result


def _dispatch_non_leave(char: CharacterType, parsed) -> list[str]:
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
            scope=RoomBroadcast.Scope.ROOM,
        )
        char.last_room_broadcast_id = rb.id
        char.save(update_fields=["last_room_broadcast_id", "updated_at"])
        return [line]

    _mark_command_boundary(char)

    if isinstance(parsed, ParsedActiveQuests):
        return _handle_active_quests(char)

    if isinstance(parsed, ParsedShopBrowse):
        return _handle_shop_browse(char, parsed)

    if isinstance(parsed, ParsedShopBuy):
        return _handle_shop_buy(char, parsed)

    if isinstance(parsed, ParsedSell):
        return _handle_shop_sell(char, parsed)

    if isinstance(parsed, ParsedRestSleep):
        return _handle_rest_sleep(char, parsed)

    if isinstance(parsed, ParsedSearch):
        _touch_activity(char)
        char.save(update_fields=["last_activity_at", "updated_at"])
        room = char.current_room
        if not room_is_narratively_visible(char, room):
            return [NARRATIVE_TOO_DARK_MESSAGE]
        _notify_peers_third_person(char, char.current_room_id, f"{char.name} is searching the area.")
        hidden = (room.search_text or "").strip()
        has_rewards = bool(
            room.search_reward_item_id
            or room.search_reveals_exit_id
            or room.search_floor_once_item_id
            or (
                room.search_floor_quest_item_id and room.search_floor_quest_state_id
            )
        )
        if not hidden and not has_rewards:
            return [
                f"You spend some time searching the {room.name} but find nothing of note."
            ]
        roll = roll_d100_plus_stat_encumbered(char, int(char.sense))
        enc = encumbrance_notice_if_hindered(char)
        if roll < int(room.search_chance):
            return enc + [
                f"You spend some time searching the {room.name} but find nothing of note."
            ]
        with transaction.atomic():
            char_locked = Character.objects.select_for_update().get(pk=char.pk)
            # of=("self",): FOR UPDATE only on qff_room. Nullable select_related() uses
            # LEFT OUTER JOINs; Postgres rejects FOR UPDATE on the nullable side of outer joins.
            room_locked = (
                Room.objects.select_for_update(of=("self",))
                .select_related(
                    "search_reward_item",
                    "search_reveals_exit",
                    "search_floor_once_item",
                    "search_floor_quest_item",
                    "search_floor_quest_state",
                )
                .get(pk=room.id)
            )
            claim, _ = CharacterRoomSearchClaim.objects.select_for_update().get_or_create(
                character_id=char_locked.pk,
                room_id=room_locked.pk,
            )
            if claim.successful_search:
                return ["Further searching this room yields nothing of note."]
            out: list[str] = []
            hidden_locked = (room_locked.search_text or "").strip()
            if hidden_locked:
                out.append(hidden_locked)
            claim_updates: list[str] = []
            claim.successful_search = True
            claim_updates.append("successful_search")
            if room_locked.search_reward_item_id and not claim.item_reward_granted:
                inst = ItemInstance.objects.create(
                    item_id=room_locked.search_reward_item_id,
                    owner_character=char_locked,
                    room=None,
                )
                inv = list(char_locked.inventory or [])
                char_locked.inventory = [inst.pk] + [x for x in inv if x != inst.pk]
                claim.item_reward_granted = True
                claim_updates.append("item_reward_granted")
                char_locked.save(update_fields=["inventory", "updated_at"])
                item_name = (
                    room_locked.search_reward_item.name
                    if room_locked.search_reward_item
                    else "something"
                )
                out.append(f"You find {item_name} and slip it into your pack.")
            if room_locked.search_reveals_exit_id and not claim.exit_reward_granted:
                ex = RoomExit.objects.filter(
                    pk=room_locked.search_reveals_exit_id,
                    from_room_id=room_locked.id,
                ).first()
                if ex:
                    CharacterExitSeen.objects.get_or_create(
                        character_id=char_locked.pk,
                        room_exit_id=ex.pk,
                    )
                    claim.exit_reward_granted = True
                    claim_updates.append("exit_reward_granted")
                    out.append("You uncover a passage you had missed before.")
            if (
                room_locked.search_floor_once_item_id
                and not claim.floor_once_reward_granted
            ):
                now = timezone.now()
                ItemInstance.objects.create(
                    item_id=room_locked.search_floor_once_item_id,
                    room_id=room_locked.id,
                    owner_character=None,
                    floor_dropped_at=now,
                )
                claim.floor_once_reward_granted = True
                claim_updates.append("floor_once_reward_granted")
                fn = (
                    room_locked.search_floor_once_item.name
                    if room_locked.search_floor_once_item
                    else "something"
                )
                out.append(f"You uncover {fn} on the ground.")
            if (
                room_locked.search_floor_quest_item_id
                and room_locked.search_floor_quest_state_id
                and can_spawn_search_quest_floor_item(
                    char_locked,
                    room_locked.id,
                    room_locked.search_floor_quest_item_id,
                    room_locked.search_floor_quest_state_id,
                )
            ):
                now = timezone.now()
                ItemInstance.objects.create(
                    item_id=room_locked.search_floor_quest_item_id,
                    room_id=room_locked.id,
                    owner_character=None,
                    floor_dropped_at=now,
                    visible_quest_state_id=room_locked.search_floor_quest_state_id,
                )
                qn = (
                    room_locked.search_floor_quest_item.name
                    if room_locked.search_floor_quest_item
                    else "something"
                )
                out.append(f"You find {qn} among the rubble.")
            if claim_updates:
                claim.save(update_fields=claim_updates)
            if not out:
                out.append(f"You search the {room.name} and uncover something new.")
            return enc + out

    if isinstance(parsed, ParsedAttack):
        return _handle_attack(char, parsed)

    if isinstance(parsed, ParsedEmote):
        return _handle_emote(char, parsed)

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

    if isinstance(parsed, ParsedPut):
        return _handle_put(char, parsed.target)

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

    if isinstance(parsed, ParsedOpenContainer):
        return _handle_open_container(char, parsed)

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
    mname = m.template.name
    if char.combat_target_monster_id == m.pk and char.next_action_at is not None:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [f"You are already attacking the {mname}."]
    now = timezone.now()
    ensure_monster_engaged_by_attacker(m, char, now)
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
    return [f"You prepare to attack the {mname}."]


def _monster_engaged_with_hero(char: CharacterType) -> bool:
    """True if any living monster is actively engaged with the hero (combat)."""
    return MonsterInstance.objects.filter(
        cur_hp__gt=0, engaged_character_id=char.pk
    ).exists()


def _complete_leave(char: CharacterType) -> None:
    """Finalize a leave: drop aggro, clear pending, flip is_in_realm False."""
    _disengage_monsters_from_hero(char, reset_hero_combat=False)
    char.next_action_at = None
    char.combat_target_monster_id = None
    char.pending_leave_at = None
    char.is_in_realm = False
    char.save(
        update_fields=[
            "next_action_at",
            "combat_target_monster",
            "pending_leave_at",
            "is_in_realm",
            "updated_at",
        ]
    )


def _handle_leave(char: CharacterType) -> list[str]:
    _touch_activity(char)
    now = timezone.now()
    if _monster_engaged_with_hero(char):
        char.pending_leave_at = None
        char.save(
            update_fields=["pending_leave_at", "last_activity_at", "updated_at"]
        )
        return ["You can't leave the realm when your life is at stake!"]
    if char.pending_leave_at is not None and char.pending_leave_at > now:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You are already preparing to leave the realm."]
    room = char.current_room
    room_is_safe = bool(getattr(room, "is_safe", False))
    if room_is_safe:
        broadcast_realm_depart(char, f"{char.name} vanishes from the realm.")
        _complete_leave(char)
        char.last_activity_at = now
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You step out of the realm and return to the lobby."]
    char.pending_leave_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
    char.save(
        update_fields=[
            "pending_leave_at",
            "last_activity_at",
            "updated_at",
        ]
    )
    _notify_peers_third_person(
        char, char.current_room_id, f"{char.name} prepares to leave the realm."
    )
    return [
        f"You prepare to leave the realm. Stay alive for {COMBAT_ROUND_SECONDS} seconds..."
    ]


_EMOTE_LINES: dict[str, dict[str, str]] = {
    "wave": {
        "self_no_target": "You wave at the room.",
        "peer_no_target": "{actor} waves.",
        "self_target": "You wave at {target}.",
        "target": "{actor} waves at you.",
        "peer_target": "{actor} waves at {target}.",
        "self_self": "You wave at yourself.",
    },
}


def _handle_emote(char: CharacterType, parsed: ParsedEmote) -> list[str]:
    _touch_activity(char)
    lines = _EMOTE_LINES.get(parsed.verb)
    if lines is None:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You try that, but nothing happens."]
    query = (parsed.target or "").strip()
    other: CharacterType | None = None
    if query:
        other = _find_character_target(char, query)

    def _save_activity() -> None:
        char.save(update_fields=["last_activity_at", "updated_at"])

    if not query or other is None:
        # Untargeted (or target not visible): broadcast to room, actor sees first-person.
        _save_activity()
        if _others_present_count(char) > 0:
            _notify_peers_third_person(
                char,
                char.current_room_id,
                lines["peer_no_target"].format(actor=char.name),
            )
        return [lines["self_no_target"]]

    if other.pk == char.pk:
        _save_activity()
        return [lines["self_self"]]

    _save_activity()
    # Line the target hero sees.
    target_rb = RoomBroadcast.objects.create(
        room_id=char.current_room_id,
        speaker_id=char.pk,
        target_character_id=other.pk,
        text=lines["target"].format(actor=char.name)[:500],
        scope=RoomBroadcast.Scope.ROOM,
    )
    last_id = target_rb.id

    # Per-onlooker targeted broadcasts so the target doesn't also see the third-person line.
    peer_line = lines["peer_target"].format(actor=char.name, target=other.name)
    for hero in Character.objects.filter(
        current_room_id=char.current_room_id,
        is_in_realm=True,
    ).exclude(pk__in=[char.pk, other.pk]):
        if not _visible_in_room(char, hero):
            continue
        rb = RoomBroadcast.objects.create(
            room_id=char.current_room_id,
            speaker_id=char.pk,
            target_character_id=hero.pk,
            text=peer_line[:500],
            scope=RoomBroadcast.Scope.ROOM,
        )
        last_id = max(last_id, rb.id)

    Character.objects.filter(pk=char.pk).update(
        last_room_broadcast_id=last_id,
        updated_at=timezone.now(),
    )
    return [lines["self_target"].format(target=other.name)]


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
    move_phase_log = getattr(settings, "QFF_COMMAND_TIMING_LOG", False)
    t_wall = time.perf_counter()

    ex = next(
        (
            row
            for row in get_room_exits_from_room(char.current_room_id)
            if row.direction == parsed.direction
        ),
        None,
    )
    _touch_activity(char)
    if not ex:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way."]
    ex_ctx = build_exit_evaluation_context(char, room_exits=[ex])
    if not exit_is_visible_to_character(char, ex, context=ex_ctx):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way."]
    if not exit_is_passable(char, ex, context=ex_ctx):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't go that way — not yet."]
    t_after_resolve = time.perf_counter()
    key_consumed, key_name = (False, None)
    if ex.lock_kind == RoomExit.LockKind.KEY:
        key_consumed, key_name = consume_key_if_entering_locked(char, ex, context=ex_ctx)
        char = Character.objects.get(pk=char.pk)
    mark_exit_used(char, ex)
    left_room_id = char.current_room_id
    dest = ex.to_room
    dir_label = ex.get_direction_display().lower()
    dir_label_title = ex.get_direction_display()
    if key_consumed and key_name:
        _notify_peers_third_person(
            char,
            left_room_id,
            f"{char.name} uses the {key_name} to unlock the way to the {dir_label_title}.",
        )
    _notify_peers_third_person(char, left_room_id, f"{char.name} heads {dir_label}.")
    char.current_room = dest
    char.save(update_fields=["current_room", "last_activity_at", "updated_at"])
    on_leave_room(left_room_id)
    on_enter_room(char, dest.id, entered_room=dest)
    refresh_torch_lit_from_hero_position(char.pk)
    _notify_peers_third_person(char, dest.id, peer_arrival_line(char.name, ex.direction))
    t_after_transit = time.perf_counter()

    from qff.monster_sim import (
        monsters_follow_hero_move,
        on_spawn_room_enter,
        safe_room_disengage,
        sense_adjacent_monster_lines,
    )

    messages: list[str] = []
    if key_consumed and key_name:
        messages.append(
            f"You use the {key_name} to unlock the way to the {dir_label_title}."
        )
    messages.append(f"You head {dir_label}.")
    dest_room = dest
    on_spawn_room_enter(char, dest_room)

    if safe_room_disengage(char, dest_room):
        messages.append("You feel safer here.")
    elif not dest_room.is_safe and char.next_action_at:
        char.next_action_at = timezone.now() + timedelta(seconds=COMBAT_ROUND_SECONDS)
        char.save(update_fields=["next_action_at", "updated_at"])
    t_after_room_hooks = time.perf_counter()

    monsters_follow_hero_move(char, left_room_id, dest.id)
    t_after_follow = time.perf_counter()
    messages.extend(sense_adjacent_monster_lines(char, dest.id))
    t_after_sense = time.perf_counter()
    _engage_monsters_after_arrival(char, dest.id)
    t_end = time.perf_counter()

    if move_phase_log:
        logger.info(
            "qff_move_phase_timing resolve_ms=%.2f key_transit_ms=%.2f room_hooks_ms=%.2f "
            "follow_ms=%.2f sense_ms=%.2f engage_ms=%.2f total_move_ms=%.2f",
            (t_after_resolve - t_wall) * 1000,
            (t_after_transit - t_after_resolve) * 1000,
            (t_after_room_hooks - t_after_transit) * 1000,
            (t_after_follow - t_after_room_hooks) * 1000,
            (t_after_sense - t_after_follow) * 1000,
            (t_end - t_after_sense) * 1000,
            (t_end - t_wall) * 1000,
        )

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

    interact = find_interactable_in_room(char, target)
    if interact:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [f"You can't take {interact.name}."]
    npc = find_npc_in_room(char, target)
    if npc:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [f"{npc.name} is flattered but unable to join you."]
    other_hero = find_other_hero_in_room(char, target)
    if other_hero:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [f"{other_hero.name} is flattered but unable to join you."]

    inst = _find_item_instance_floor_first(char, target)
    if inst and inst.room_id == char.current_room_id and inst.owner_character_id is None:
        pickup_label = inventory_stack_label(inst)
        donor_qty = max(1, int(inst.quantity or 1))
        take_qty = max(1, int(want_qty or 1))
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
            donor_qty = max(1, int(inst.quantity or 1))
            take_qty = min(take_qty, donor_qty)
            _dest_pks, new_pks = absorb_item_quantity(char, item, take_qty, donor=inst)
            if take_qty >= donor_qty:
                inst.delete()
            else:
                inst.quantity = donor_qty - take_qty
                inst.save(update_fields=["quantity", "updated_at"])
            for pk in reversed(new_pks):
                char.inventory = _prepend_inv(char.inventory, pk)
            char.last_activity_at = timezone.now()
            char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
        char = Character.objects.get(pk=char.pk)
        _notify_peers_third_person(
            char, char.current_room_id, f"{char.name} takes the {pickup_label}."
        )
        if take_qty == 1:
            return [f"You pick up the {pickup_label}."]
        return [f"You pick up {take_qty} {pickup_label}."]

    ri = _find_room_item(char, target)
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
        destination_pks, new_pks = absorb_item_quantity(char, ri.item, 1, donor=None)
        for pk in reversed(new_pks):
            char.inventory = _prepend_inv(char.inventory, pk)
        for dest_pk in destination_pks:
            RoomItemSpawn.objects.create(
                room_item_id=ri.pk,
                character_id=char.pk,
                item_instance_id=dest_pk,
            )
        if ri.mint_policy == RoomItem.MintPolicy.ONCE_EVER:
            RoomItemCharacterClaim.objects.get_or_create(
                room_item_id=ri.pk, character_id=char.pk
            )
        char.last_activity_at = timezone.now()
        char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
    char = Character.objects.get(pk=char.pk)
    _notify_peers_third_person(
        char, char.current_room_id, f"{char.name} takes the {pickup_name}."
    )
    return [f"You pick up the {pickup_name}."]


def _handle_put(char: CharacterType, target: str) -> list[str]:
    _touch_activity(char)
    q = (target or "").strip()
    if not q:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Put what?"]
    cid = char.opened_container_interactable_id
    if not cid:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Open a container first — nothing is open to put things into."]
    obj = Interactable.objects.filter(pk=cid, room_id=char.current_room_id).first()
    if not obj:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return [
            "Nothing is open to receive that — the container you had open is no longer here."
        ]
    inst = _find_item_instance_inventory_first(char, q)
    inv = list(char.inventory or [])
    if not inst or inst.pk not in inv:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    if inst.room_id is not None:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    if _instance_is_equipped(char, inst.pk):
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Remove that before you stash it."]
    label = display_name_for_instance(inst)
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        inst = ItemInstance.objects.select_for_update().select_related("item").get(pk=inst.pk)
        inv = list(char.inventory or [])
        if inst.pk not in inv or inst.owner_character_id != char.pk:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have that."]
        if not char.opened_container_interactable_id:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return [
                "Nothing is open to put that into anymore — open the container again first."
            ]
        cid_locked = char.opened_container_interactable_id
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
        inst.owner_character_id = None
        inst.room_id = char.current_room_id
        inst.container_interactable_id = cid_locked
        inst.save(
            update_fields=[
                "owner_character",
                "room",
                "container_interactable",
                "updated_at",
            ]
        )
        char.save(update_fields=["inventory", "last_activity_at", "updated_at"])
    char = Character.objects.get(pk=char.pk)
    _notify_peers_third_person(
        char,
        char.current_room_id,
        f"{char.name} puts the {label} into the {obj.name}.",
    )
    return [f"You put the {label} into the {obj.name}."]


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


def _consume_verb_rejection_message(item, attempted_verb: str) -> str | None:
    """If Item.consume_verb is set, require matching eat/drink/use."""
    required = (getattr(item, "consume_verb", None) or "").strip().lower()
    if not required:
        return None
    got = (attempted_verb or "").strip().lower()
    if got == required:
        return None
    if got == "use" and required in ("eat", "drink", "read"):
        return None
    if required == "eat":
        if got == "drink":
            return "That isn't something you drink."
        if got == "use":
            return "You need to eat that, not use it."
        if got == "read":
            return "You need to eat that, not read it."
        return "You can't consume that that way."
    if required == "drink":
        if got == "eat":
            return "That isn't something you eat."
        if got == "use":
            return "You need to drink that, not use it."
        if got == "read":
            return "You need to drink that, not read it."
        return "You can't consume that that way."
    if required == "use":
        if got in ("eat", "drink", "read"):
            return "You need to use that."
        return "You can't consume that that way."
    if required == "read":
        if got in ("eat", "drink"):
            return "You need to read that, not consume it like food."
        if got == "use":
            return "You need to read that, not use it."
        return "You can't consume that that way."
    return None


def _apply_teleport_spawn_scroll(actor_pk: int, left_room_id: int) -> list[str]:
    """Move hero to spawn_room after consuming a teleport scroll (same hooks as walking)."""
    from qff.monster_sim import (
        monsters_follow_hero_move,
        on_spawn_room_enter,
        safe_room_disengage,
        sense_adjacent_monster_lines,
    )

    ch = Character.objects.select_related("spawn_room").get(pk=actor_pk)
    dest_id = ch.spawn_room_id
    if not dest_id or dest_id == ch.current_room_id:
        return []
    actor_name = ch.name
    _notify_peers_third_person(ch, left_room_id, f"{actor_name} vanishes in a swirl of light.")
    dest = Room.objects.get(pk=dest_id)
    ch.current_room = dest
    ch.save(update_fields=["current_room", "updated_at"])
    on_leave_room(left_room_id)
    on_enter_room(ch, dest_id, entered_room=dest)
    refresh_torch_lit_from_hero_position(actor_pk)
    _notify_peers_third_person(ch, dest_id, f"{actor_name} appears in a swirl of light.")
    on_spawn_room_enter(ch, dest)
    safe_room_disengage(ch, dest)
    monsters_follow_hero_move(ch, left_room_id, dest_id)
    sense_lines = sense_adjacent_monster_lines(ch, dest_id)
    _engage_monsters_after_arrival(ch, dest_id)
    return ["The scroll whisks you back to where you began.", *sense_lines]


def _healer_offer(char: CharacterType, npc: Npc) -> list[str]:
    if int(char.cur_health) >= int(char.max_health):
        return [f"{npc.name} says: You don't need my services right now."]
    cost = int(npc.healing_cost or 0)
    if cost <= 0:
        char.cur_health = char.max_health
        char.save(update_fields=["cur_health", "last_activity_at", "updated_at"])
        return [f"{npc.name} heals you to full health."]
    if int(char.gold) < cost:
        return ["You can't afford my services!"]
    char.pending_prompt = {"kind": "healer_pay", "npc_id": npc.id, "cost": cost}
    char.save(update_fields=["pending_prompt", "last_activity_at", "updated_at"])
    return [f"{npc.name} says: I can restore your health for {cost} gold. Pay? (y/n)"]


def _innkeeper_offer(char: CharacterType, npc: Npc) -> list[str]:
    already_rested = (
        int(char.cur_health) >= int(char.max_health)
        and int(char.cur_mana) >= int(char.max_mana)
        and char.spawn_room_id == npc.room_id
    )
    if already_rested:
        return [f"{npc.name} says: You look well-rested already."]
    cost = int(npc.healing_cost or 0)
    if cost <= 0:
        char.cur_health = char.max_health
        char.cur_mana = char.max_mana
        char.spawn_room_id = npc.room_id
        char.save(
            update_fields=[
                "cur_health",
                "cur_mana",
                "spawn_room",
                "last_activity_at",
                "updated_at",
            ]
        )
        return [
            f"You stay the night. {npc.name} welcomes you; this inn is now your refuge."
        ]
    if int(char.gold) < cost:
        return ["You can't afford my services!"]
    char.pending_prompt = {"kind": "innkeeper_stay", "npc_id": npc.id, "cost": cost}
    char.save(update_fields=["pending_prompt", "last_activity_at", "updated_at"])
    return [
        f"{npc.name} says: A room for the night is {cost} gold — "
        f"it'll restore you and you'll wake here if you fall. Stay? (y/n)"
    ]


def _service_offer(char: CharacterType, npc: Npc) -> list[str] | None:
    """Return service-NPC offer lines if this NPC is a healer/innkeeper, else None.

    Innkeepers take precedence when both flags are set (superset of healer behavior).
    """
    if getattr(npc, "is_innkeeper", False):
        return _innkeeper_offer(char, npc)
    if getattr(npc, "is_healer", False):
        return _healer_offer(char, npc)
    return None


def _healer_pay_accept(char: CharacterType, pending: dict) -> list[str]:
    npc_id = int(pending.get("npc_id") or 0)
    cost = int(pending.get("cost") or 0)
    npc = Npc.objects.filter(pk=npc_id, room_id=char.current_room_id, is_healer=True).first()
    if not npc or int(npc.healing_cost or 0) != cost or int(char.gold) < cost:
        char.pending_prompt = None
        char.save(update_fields=["pending_prompt", "updated_at"])
        return ["Never mind."]
    char.gold = int(char.gold) - cost
    char.cur_health = char.max_health
    char.pending_prompt = None
    char.save(
        update_fields=["gold", "cur_health", "pending_prompt", "updated_at"]
    )
    return [f"You pay {cost} gold and are healed to full health."]


def _innkeeper_stay_accept(char: CharacterType, pending: dict) -> list[str]:
    npc_id = int(pending.get("npc_id") or 0)
    cost = int(pending.get("cost") or 0)
    npc = Npc.objects.filter(
        pk=npc_id, room_id=char.current_room_id, is_innkeeper=True
    ).first()
    if not npc or int(npc.healing_cost or 0) != cost or int(char.gold) < cost:
        char.pending_prompt = None
        char.save(update_fields=["pending_prompt", "updated_at"])
        return ["Never mind."]
    char.gold = int(char.gold) - cost
    char.cur_health = char.max_health
    char.cur_mana = char.max_mana
    char.spawn_room_id = npc.room_id
    char.pending_prompt = None
    char.save(
        update_fields=[
            "gold",
            "cur_health",
            "cur_mana",
            "spawn_room",
            "pending_prompt",
            "updated_at",
        ]
    )
    return [
        f"You pay {cost} gold and stay the night. You feel fully restored. "
        f"This inn is now your refuge."
    ]


def _prompt_decline(char: CharacterType) -> list[str]:
    char.pending_prompt = None
    char.save(update_fields=["pending_prompt", "updated_at"])
    return ["You decline."]


def maybe_handle_pending_prompt(char: CharacterType, line: str) -> list[str] | None:
    """Intercept y/n answers to a pending service-NPC prompt.

    Returns message lines if the line was consumed by the prompt, else None. A
    non-y/n answer clears the prompt and returns None so the caller falls through
    to normal parsing.
    """
    pending = getattr(char, "pending_prompt", None)
    if not isinstance(pending, dict):
        return None
    kind = pending.get("kind")
    if kind not in ("healer_pay", "innkeeper_stay"):
        return None
    raw = (line or "").strip().lower().lstrip(">").strip()
    if raw.startswith("/"):
        raw = raw[1:].strip()
    if raw in ("y", "yes", "aye"):
        _touch_activity(char)
        if kind == "healer_pay":
            return _healer_pay_accept(char, pending)
        return _innkeeper_stay_accept(char, pending)
    if raw in ("n", "no", "nay"):
        _touch_activity(char)
        return _prompt_decline(char)
    # Fall-through: clear prompt and let normal parsing run.
    char.pending_prompt = None
    char.save(update_fields=["pending_prompt", "updated_at"])
    return None


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
    char = Character.objects.get(pk=char.pk)
    browse_lines: list[str] = []
    try:
        shop = npc.shop
        if shop.enabled:
            browse_lines = list(browse_shop(char, shop))
    except NpcShop.DoesNotExist:
        pass
    service = _service_offer(char, npc)
    char.save(update_fields=["last_activity_at", "updated_at"])
    block = extra + [main] + browse_lines
    if service is not None:
        return block + service
    return block


def _handle_open_container(char: CharacterType, parsed: ParsedOpenContainer) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Open what?"]
    if not room_is_narratively_visible(char, char.current_room):
        return [NARRATIVE_TOO_DARK_MESSAGE]
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
        _interactable_observer_line(char.name, "open", obj.name),
    )
    return lines


def _handle_rest_sleep(char: CharacterType, _parsed: ParsedRestSleep) -> list[str]:
    _touch_activity(char)
    npc = (
        Npc.objects.filter(room_id=char.current_room_id, is_innkeeper=True)
        .order_by("id")
        .first()
        or Npc.objects.filter(room_id=char.current_room_id, is_healer=True)
        .order_by("id")
        .first()
    )
    if not npc:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["There's no place to rest here."]
    lines = _service_offer(char, npc) or []
    char.save(update_fields=["last_activity_at", "updated_at"])
    return lines


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

    inv = list(char.inventory or [])
    inv_consumables = [
        c for c in _inventory_consumable_candidates(char, target) if c.pk in inv
    ]
    picked = _pick_single_consumable_candidate(inv_consumables, target)
    if picked:
        return _consume_inventory_instance(char, picked, "use")
    if len(inv_consumables) > 1:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["What do you want to use?"]

    inst = _find_item_instance_inventory_first(char, target)
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
    verb = parsed.verb
    inv = list(char.inventory or [])
    inv_consumables = [
        c
        for c in _inventory_consumable_candidates(char, target)
        if c.pk in inv and _consumable_matches_inventory_verb(c.item, verb)
    ]
    picked = _pick_single_consumable_candidate(inv_consumables, target)
    if picked:
        return _consume_inventory_instance(char, picked, verb)
    if len(inv_consumables) > 1:
        char.save(update_fields=["last_activity_at", "updated_at"])
        if verb == "eat":
            return ["What do you want to eat?"]
        return ["What do you want to drink?"]
    inst = _find_item_instance_inventory_first(char, target)
    if not inst or inst.pk not in inv:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You don't have that."]
    if not inst.item.consumable:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["You can't consume that."]
    return _consume_inventory_instance(char, inst, verb)


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
    had_teleport = False
    with transaction.atomic():
        char = Character.objects.select_for_update().get(pk=char.pk)
        inst = II.objects.select_for_update().select_related("item").get(pk=inst.pk)
        inv = list(char.inventory or [])
        if inst.pk not in inv or not inst.item.consumable:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["You don't have that."]
        rej = _consume_verb_rejection_message(inst.item, verb)
        if rej:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return [rej]
        had_teleport = consume_effects_contain_teleport_spawn(inst.item)
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
                    "dark_minimap_torch_radius",
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
                    "dark_minimap_torch_radius",
                    "last_activity_at",
                    "updated_at",
                ]
            )

    ch = Character.objects.get(pk=actor_pk)
    v = verb.lower()
    if v == "use":
        req = (inst.item.consume_verb or "").strip().lower()
        if req in ("eat", "drink", "read"):
            v = req
    if v == "eat":
        _notify_peers_third_person(ch, room_id, f"{actor_name} eats the {base_label}.")
        out = [f"You eat the {base_label}."] + effect_lines
    elif v == "drink":
        _notify_peers_third_person(ch, room_id, f"{actor_name} drinks the {base_label}.")
        out = [f"You drink the {base_label}."] + effect_lines
    elif v == "read":
        _notify_peers_third_person(ch, room_id, f"{actor_name} reads the {base_label}.")
        out = [f"You read the {base_label}."] + effect_lines
    else:
        _notify_peers_third_person(ch, room_id, f"{actor_name} uses the {base_label}.")
        out = [f"You use the {base_label}."] + effect_lines
    if had_teleport:
        out = out + _apply_teleport_spawn_scroll(actor_pk, room_id)
    return out


def _handle_read(char: CharacterType, parsed: ParsedRead) -> list[str]:
    _touch_activity(char)
    target = (parsed.target or "").strip()
    if not target:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["Read what?"]
    if not room_is_narratively_visible(char, char.current_room):
        return [NARRATIVE_TOO_DARK_MESSAGE]
    obj = find_interactable_in_room(char, target)
    if obj:
        if obj.untranslated:
            text = (obj.read_text or "").strip()
        else:
            text = (obj.read_text or "").strip() or (obj.inspect_text or "").strip()
        if not text:
            char.save(update_fields=["last_activity_at", "updated_at"])
            return ["There is nothing to read."]
        _notify_peers_third_person(
            char, char.current_room_id, f"{char.name} reads the {obj.name}."
        )
        char.save(update_fields=["last_activity_at", "updated_at"])
        if obj.untranslated and not _character_has_alien_glyph(char):
            return ["You don't understand the alien language."]
        if obj.untranslated and _character_has_alien_glyph(char):
            return [f"Your alien is rusty, but it says something like: ‘{text}’"]
        return [text]

    inv = list(char.inventory or [])
    inv_read = [
        c
        for c in _inventory_consumable_candidates(char, target)
        if c.pk in inv
        and (
            not (c.item.consume_verb or "").strip()
            or (c.item.consume_verb or "").strip().lower() == "read"
        )
    ]
    picked = _pick_single_consumable_candidate(inv_read, target)
    if picked:
        return _consume_inventory_instance(char, picked, "read")
    if len(inv_read) > 1:
        char.save(update_fields=["last_activity_at", "updated_at"])
        return ["What do you want to read?"]

    char.save(update_fields=["last_activity_at", "updated_at"])
    return ["You don't see that here."]


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
            return [NARRATIVE_TOO_DARK_MESSAGE]
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
            return [NARRATIVE_TOO_DARK_MESSAGE]
        rname = (room.name or "").strip() or "here"
        out = [rname + "."]
        labels = occupant_labels_for_look(char, room.id)
        if labels:
            out.append(f"You make out: {_natural_join_phrases(labels)}.")
        return out

    if not room_is_narratively_visible(char, char.current_room):
        return [NARRATIVE_TOO_DARK_MESSAGE]

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
        if interactable.kind == Interactable.Kind.CONTAINER:
            inside: list[str] = []
            for inst in ItemInstance.objects.filter(
                room_id=char.current_room_id,
                container_interactable_id=interactable.pk,
                owner_character__isnull=True,
            ).select_related("item", "visible_quest_state"):
                if floor_item_visible_to_character(char, inst):
                    inside.append(display_name_for_instance(inst))
            container_room_items = list(
                RoomItem.objects.filter(
                    room_id=char.current_room_id,
                    interactable_id=interactable.pk,
                ).select_related("item", "visible_quest_state")
            )
            ri_batch = build_room_item_visibility_batch(
                char, char.current_room_id, container_room_items
            )
            for ri in container_room_items:
                if room_item_visible_to_character(char, ri, ri_batch):
                    inside.append(_room_item_display_label(ri))
            if inside:
                out.append(f"Inside: {_natural_join_phrases(inside)}.")
        return out

    monster = _find_monster_in_room(char, target)
    if monster:
        _look_focus_peers(char, parsed, monster.template.name)
        tpl = monster.template
        base = (tpl.description or "").strip() or f"You see the {tpl.name}."
        hidden = (tpl.hidden_description or "").strip()
        if hidden:
            dc = int(tpl.lore_dc) if tpl.lore_dc is not None else int(tpl.level)
            smarts = int(modified_stats(char)["smarts"])
            roll = roll_d100_plus_stat_encumbered(char, smarts)
            enc = encumbrance_notice_if_hindered(char)
            if roll >= dc:
                return enc + [base, hidden]
            return enc + [base]
        return [base]

    subj = _find_character_target(char, target)
    if subj:
        _look_focus_peers(char, parsed, subj.name)
        return _lines_for_character_inspect(char, subj, parsed.verb == "inspect")

    inst = _find_item_instance_floor_first(char, target)
    if inst:
        _look_focus_peers(char, parsed, f"the {display_name_for_instance(inst)}")
        return _lines_for_item_inspect(char, inst)

    ri = _find_room_item(char, target)
    if ri:
        _look_focus_peers(char, parsed, f"the {_room_item_display_label(ri)}")
        return _lines_for_item_inspect_core(char, ri.item, None)

    shop_line = find_any_shop_line_in_room(char, target)
    if shop_line is not None:
        if (
            shop_line.kind == NpcShopStockLine.Kind.CONSIGNMENT
            and shop_line.consignment_item_instance_id
        ):
            cinst = (
                ItemInstance.objects.select_related("item")
                .filter(pk=shop_line.consignment_item_instance_id)
                .first()
            )
            if cinst:
                _look_focus_peers(
                    char, parsed, f"the {display_name_for_instance(cinst)}"
                )
                return _lines_for_item_inspect(char, cinst)
        it = shop_line.item
        _look_focus_peers(char, parsed, f"the {it.name}")
        base = (it.description or "").strip() or f"It is {it.name}."
        extra = format_item_inspect_parenthetical(it, False)
        return [(base + extra).strip()]

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


def _lines_for_item_inspect_core(
    actor: CharacterType, it: Item, inst: ItemInstance | None
) -> list[str]:
    """Shared look/inspect lore for floor, inventory, or visible room items (no instance)."""
    base = (it.description or "").strip() or f"It is {it.name}."
    template_knows = character_knows_item_lore_for_template(actor, it)
    if inst is not None:
        effective = inst.unlocked or template_knows
    else:
        effective = template_knows
    lore_extra = ""
    enc: list[str] = []
    if it.lore_chance is None:
        if (it.lore or "").strip():
            lore_extra = " " + it.lore.strip()
        if inst is not None:
            inst.unlocked = True
            inst.save(update_fields=["unlocked", "updated_at"])
        ensure_character_item_lore_template_unlocked(actor, it)
    else:
        if effective:
            if (it.lore or "").strip():
                lore_extra = " " + it.lore.strip()
            if inst is not None and not inst.unlocked and template_knows:
                inst.unlocked = True
                inst.save(update_fields=["unlocked", "updated_at"])
        else:
            enc = encumbrance_notice_if_hindered(actor)
            roll = roll_d100_plus_stat_encumbered(actor, int(actor.smarts))
            if roll >= int(it.lore_chance):
                if inst is not None:
                    inst.unlocked = True
                    inst.save(update_fields=["unlocked", "updated_at"])
                ensure_character_item_lore_template_unlocked(actor, it)
                if (it.lore or "").strip():
                    lore_extra = " " + it.lore.strip()
            else:
                if inst is not None:
                    failed = list(inst.chars_failed_to_inspect or [])
                    if actor.pk not in failed:
                        failed.append(actor.pk)
                        inst.chars_failed_to_inspect = failed
                        inst.save(
                            update_fields=["chars_failed_to_inspect", "updated_at"]
                        )
    text = (base + lore_extra).strip()
    lore_revealed = (it.lore_chance is None) or character_knows_item_lore_for_template(
        actor, it
    )
    if inst is not None and inst.unlocked:
        lore_revealed = True
    extra = format_item_inspect_parenthetical(it, lore_revealed)
    if extra:
        text = text + extra
    return enc + [text]


def _lines_for_item_inspect(actor: CharacterType, inst: ItemInstance) -> list[str]:
    return _lines_for_item_inspect_core(actor, inst.item, inst)
