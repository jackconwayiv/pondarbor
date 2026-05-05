"""Room exit locks: realm-wide timed unlocks and per-character unlocks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from qff.game_helpers import load_inventory_instance_map
from qff.static_cache import get_item_by_id
from qff.models import (
    Character,
    CharacterExitSeen,
    CharacterExitUnlock,
    CharacterQuestProgress,
    ItemInstance,
    RealmExitUnlock,
    RoomExit,
)

SLOT_ATTRS = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)


@dataclass(frozen=True)
class ExitEvaluationContext:
    """Per-request snapshots used by exit visibility/passability checks."""

    inventory_instance_map: dict[int, ItemInstance]
    active_quest_state_ids: frozenset[int]
    seen_exit_ids: frozenset[int] | None = None


def build_exit_evaluation_context(
    character: Character, room_exits: Iterable[RoomExit] | None = None
) -> ExitEvaluationContext:
    """Build one context for all exit checks in a request.

    `room_exits` is optional; when provided we prefetch CharacterExitSeen for those
    exit ids to avoid per-exit `.exists()` calls in hidden/no-reveal paths.
    """
    inv_map = load_inventory_instance_map(character)
    quest_state_ids = frozenset(
        CharacterQuestProgress.objects.filter(character_id=character.pk).values_list(
            "current_state_id", flat=True
        )
    )
    seen_exit_ids: frozenset[int] | None = None
    if room_exits is not None:
        exit_ids = [ex.pk for ex in room_exits]
        if exit_ids:
            seen_exit_ids = frozenset(
                CharacterExitSeen.objects.filter(
                    character_id=character.pk, room_exit_id__in=exit_ids
                ).values_list("room_exit_id", flat=True)
            )
        else:
            seen_exit_ids = frozenset()
    return ExitEvaluationContext(
        inventory_instance_map=inv_map,
        active_quest_state_ids=quest_state_ids,
        seen_exit_ids=seen_exit_ids,
    )


def realm_unlock_active(room_exit: RoomExit) -> bool:
    try:
        ru = room_exit.realm_unlock
    except RealmExitUnlock.DoesNotExist:
        return False
    return ru.expires_at > timezone.now()


def character_unlock_active(character: Character, room_exit: RoomExit) -> bool:
    u = (
        CharacterExitUnlock.objects.filter(
            character=character,
            room_exit=room_exit,
        )
        .order_by("-id")
        .first()
    )
    if not u:
        return False
    if u.expires_at is None:
        return True
    return u.expires_at > timezone.now()


def _set_realm_unlock(room_exit: RoomExit, *, seconds: int) -> None:
    expires = timezone.now() + timedelta(seconds=seconds)
    RealmExitUnlock.objects.update_or_create(
        room_exit=room_exit,
        defaults={"expires_at": expires},
    )


def _set_character_unlock(character: Character, room_exit: RoomExit) -> None:
    CharacterExitUnlock.objects.update_or_create(
        character=character,
        room_exit=room_exit,
        defaults={"expires_at": None},
    )


def _find_key_instance(
    character: Character,
    key_item_id: int,
    *,
    inventory_instance_map: dict[int, ItemInstance] | None = None,
) -> ItemInstance | None:
    """First matching key in inventory order, then equipment."""
    inv_map = (
        inventory_instance_map
        if inventory_instance_map is not None
        else load_inventory_instance_map(character)
    )
    for iid in character.inventory or []:
        inst = inv_map.get(iid)
        if inst and inst.item_id == key_item_id:
            return inst
    for attr in SLOT_ATTRS:
        inst = getattr(character, attr, None)
        if inst and inst.item_id == key_item_id and inst.pk not in inv_map:
            return inst
    return None


@transaction.atomic
def consume_key_and_unlock(
    character: Character,
    room_exit: RoomExit,
    *,
    context: ExitEvaluationContext | None = None,
) -> bool:
    """Return True if a key was consumed and unlock recorded."""
    if not room_exit.key_item_id:
        return False
    inst = _find_key_instance(
        character,
        room_exit.key_item_id,
        inventory_instance_map=(context.inventory_instance_map if context else None),
    )
    if not inst:
        return False
    char = Character.objects.select_for_update().get(pk=character.pk)
    inst = ItemInstance.objects.select_for_update().get(pk=inst.pk)
    qty = max(1, int(inst.quantity or 1))
    if qty > 1:
        inst.quantity = qty - 1
        inst.save(update_fields=["quantity", "updated_at"])
    else:
        for attr in SLOT_ATTRS:
            cur = getattr(char, attr, None)
            if cur and cur.pk == inst.pk:
                setattr(char, attr, None)
                break
        inv = list(char.inventory or [])
        if inst.pk in inv:
            inv = [x for x in inv if x != inst.pk]
            char.inventory = inv
        inst.delete()
    if room_exit.key_unlock_scope == RoomExit.KeyUnlockScope.REALM_TIMED:
        _set_realm_unlock(room_exit, seconds=int(room_exit.unlock_duration_seconds))
    else:
        _set_character_unlock(char, room_exit)
    char.save()
    return True


def passable_unlock_state(character: Character, room_exit: RoomExit) -> bool:
    """True if timed realm or character-specific unlock already applies."""
    if realm_unlock_active(room_exit):
        return True
    if character_unlock_active(character, room_exit):
        return True
    return False


def exit_appears_locked_for_display(character: Character, room_exit: RoomExit) -> bool:
    """True when a KEY exit has not been opened for this character/realm yet (still shows (locked))."""
    if room_exit.lock_kind != RoomExit.LockKind.KEY:
        return False
    return not passable_unlock_state(character, room_exit)


def exit_is_visible_to_character(
    character: Character,
    room_exit: RoomExit,
    *,
    context: ExitEvaluationContext | None = None,
) -> bool:
    """Whether this exit appears in play (HUD, map, movement) for the character."""
    if not room_exit.is_hidden:
        return True
    need_item = room_exit.reveal_item_id
    need_quest = room_exit.reveal_quest_state_id
    if need_item or need_quest:
        ok_item = True
        ok_quest = True
        if need_item:
            ok_item = bool(
                _find_key_instance(
                    character,
                    need_item,
                    inventory_instance_map=(
                        context.inventory_instance_map if context else None
                    ),
                )
            )
        if need_quest:
            if context is not None:
                ok_quest = room_exit.reveal_quest_state_id in context.active_quest_state_ids
            else:
                qs = room_exit.reveal_quest_state
                ok_quest = CharacterQuestProgress.objects.filter(
                    character=character,
                    quest_id=qs.quest_id,
                    current_state_id=qs.id,
                ).exists()
        return ok_item and ok_quest
    if context is not None and context.seen_exit_ids is not None:
        return room_exit.pk in context.seen_exit_ids
    return CharacterExitSeen.objects.filter(
        character_id=character.pk, room_exit_id=room_exit.pk
    ).exists()


def exit_is_passable(
    character: Character,
    room_exit: RoomExit,
    *,
    context: ExitEvaluationContext | None = None,
) -> bool:
    """Whether the character may move through this exit (before consuming a key)."""
    lk = room_exit.lock_kind
    if lk == RoomExit.LockKind.NONE:
        return True
    if passable_unlock_state(character, room_exit):
        return True
    if lk == RoomExit.LockKind.KEY:
        return bool(
            room_exit.key_item_id
            and _find_key_instance(
                character,
                room_exit.key_item_id,
                inventory_instance_map=(
                    context.inventory_instance_map if context else None
                ),
            )
        )
    if lk == RoomExit.LockKind.DEVICE:
        return False
    if lk == RoomExit.LockKind.QUEST:
        if not room_exit.quest_required_state_id:
            return False
        if context is not None:
            return room_exit.quest_required_state_id in context.active_quest_state_ids
        qs = room_exit.quest_required_state
        return CharacterQuestProgress.objects.filter(
            character=character,
            quest_id=qs.quest_id,
            current_state_id=qs.id,
        ).exists()
    return False


@transaction.atomic
def consume_key_if_entering_locked(
    character: Character,
    room_exit: RoomExit,
    *,
    context: ExitEvaluationContext | None = None,
) -> tuple[bool, str | None]:
    """If KEY exit and not yet unlocked, consume key when ``consume_key_on_pass``.

    Returns (consumed, key_item_name) for self/room messages.
    """
    if room_exit.lock_kind != RoomExit.LockKind.KEY:
        return (False, None)
    if passable_unlock_state(character, room_exit):
        return (False, None)
    if not room_exit.consume_key_on_pass:
        return (False, None)
    key_name: str | None = None
    if room_exit.key_item_id and room_exit.key_item:
        key_name = (room_exit.key_item.name or "").strip() or "key"
    elif room_exit.key_item_id:
        key_obj = get_item_by_id(room_exit.key_item_id)
        key_name = ((key_obj.name if key_obj else "") or "").strip() or "key"
    consumed = consume_key_and_unlock(character, room_exit, context=context)
    if consumed and not key_name:
        key_name = "key"
    return (consumed, key_name if consumed else None)
