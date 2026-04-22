"""Room exit locks: realm-wide timed unlocks and per-character unlocks."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from qff.models import (
    Character,
    CharacterExitSeen,
    CharacterExitUnlock,
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


def _find_key_instance(character: Character, key_item_id: int) -> ItemInstance | None:
    """First matching key in inventory order, then equipment."""
    seen: set[int] = set()
    for iid in character.inventory or []:
        if iid in seen:
            continue
        inst = (
            ItemInstance.objects.filter(pk=iid, owner_character_id=character.pk)
            .select_related("item")
            .first()
        )
        if inst and inst.item_id == key_item_id:
            return inst
        if inst:
            seen.add(inst.pk)
    for attr in SLOT_ATTRS:
        inst = getattr(character, attr, None)
        if inst and inst.item_id == key_item_id and inst.pk not in seen:
            return inst
    return None


@transaction.atomic
def consume_key_and_unlock(
    character: Character,
    room_exit: RoomExit,
) -> bool:
    """Return True if a key was consumed and unlock recorded."""
    if not room_exit.key_item_id:
        return False
    inst = _find_key_instance(character, room_exit.key_item_id)
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


def exit_is_visible_to_character(character: Character, room_exit: RoomExit) -> bool:
    """Whether this exit appears in play (HUD, map, movement) for the character."""
    if not room_exit.is_hidden:
        return True
    need_item = room_exit.reveal_item_id
    need_quest = room_exit.reveal_quest_state_id
    if need_item or need_quest:
        ok_item = True
        ok_quest = True
        if need_item:
            ok_item = bool(_find_key_instance(character, need_item))
        if need_quest:
            from qff.models import CharacterQuestProgress

            qs = room_exit.reveal_quest_state
            ok_quest = CharacterQuestProgress.objects.filter(
                character=character,
                quest_id=qs.quest_id,
                current_state_id=qs.id,
            ).exists()
        return ok_item and ok_quest
    return CharacterExitSeen.objects.filter(
        character_id=character.pk, room_exit_id=room_exit.pk
    ).exists()


def exit_is_passable(character: Character, room_exit: RoomExit) -> bool:
    """Whether the character may move through this exit (before consuming a key)."""
    from qff.models import CharacterQuestProgress

    lk = room_exit.lock_kind
    if lk == RoomExit.LockKind.NONE:
        return True
    if passable_unlock_state(character, room_exit):
        return True
    if lk == RoomExit.LockKind.KEY:
        return bool(
            room_exit.key_item_id
            and _find_key_instance(character, room_exit.key_item_id)
        )
    if lk == RoomExit.LockKind.DEVICE:
        return False
    if lk == RoomExit.LockKind.QUEST:
        if not room_exit.quest_required_state_id:
            return False
        qs = room_exit.quest_required_state
        return CharacterQuestProgress.objects.filter(
            character=character,
            quest_id=qs.quest_id,
            current_state_id=qs.id,
        ).exists()
    return False


@transaction.atomic
def consume_key_if_entering_locked(
    character: Character, room_exit: RoomExit
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
        from qff.models import Item

        key_name = (
            Item.objects.filter(pk=room_exit.key_item_id).values_list("name", flat=True).first()
        )
        key_name = (str(key_name).strip() if key_name else None) or "key"
    consumed = consume_key_and_unlock(character, room_exit)
    if consumed and not key_name:
        key_name = "key"
    return (consumed, key_name if consumed else None)
