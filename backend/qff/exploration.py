"""Fog-of-war: visits and seen exits when entering a room."""

from django.db import transaction
from django.utils import timezone

from qff.models import Character, CharacterExitSeen, CharacterRoomVisit, RoomExit


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
def on_enter_room(character: Character, room_id: int) -> None:
    mark_room_visited(character, room_id)
    mark_visible_exits_seen(character, room_id)


def mark_exit_used(character: Character, room_exit: RoomExit) -> None:
    CharacterExitSeen.objects.get_or_create(
        character=character,
        room_exit=room_exit,
    )
