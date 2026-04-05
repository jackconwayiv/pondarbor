"""Fog-of-war: visits and seen exits when entering a room."""

from datetime import timedelta

from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from qff.constants import FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES
from qff.models import (
    Character,
    CharacterExitSeen,
    CharacterRoomVisit,
    ItemInstance,
    RoomBroadcast,
    RoomExit,
)

# Unowned floor items are deleted after this many departures from the room.
FLOOR_ITEM_NEGLECT_DELETE_AT = 4


def mark_room_visited(character: Character, room_id: int) -> None:
    CharacterRoomVisit.objects.get_or_create(
        character=character,
        room_id=room_id,
    )


def mark_visible_exits_seen(character: Character, room_id: int) -> None:
    exits = RoomExit.objects.filter(
        from_room_id=room_id,
        is_hidden=False,
    ).values_list("id", flat=True)
    for eid in exits:
        CharacterExitSeen.objects.get_or_create(
            character=character,
            room_exit_id=eid,
        )


@transaction.atomic
def on_leave_room(room_id: int) -> None:
    """When a player exits a room, bump neglect on floor loot; remove at threshold and age."""
    ItemInstance.objects.filter(
        room_id=room_id,
        owner_character__isnull=True,
    ).update(neglect_count=F("neglect_count") + 1)
    older_than = timezone.now() - timedelta(
        minutes=FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES
    )
    ItemInstance.objects.filter(
        room_id=room_id,
        owner_character__isnull=True,
        neglect_count__gte=FLOOR_ITEM_NEGLECT_DELETE_AT,
        floor_dropped_at__lte=older_than,
    ).delete()


@transaction.atomic
def on_enter_room(character: Character, room_id: int) -> None:
    mark_room_visited(character, room_id)
    mark_visible_exits_seen(character, room_id)
    max_bid = RoomBroadcast.objects.filter(room_id=room_id).aggregate(m=Max("id"))["m"]
    character.last_room_broadcast_id = int(max_bid or 0)
    character.save(update_fields=["last_room_broadcast_id", "updated_at"])


def mark_exit_used(character: Character, room_exit: RoomExit) -> None:
    CharacterExitSeen.objects.get_or_create(
        character=character,
        room_exit=room_exit,
    )
