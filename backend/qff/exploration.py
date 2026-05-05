"""Fog-of-war: visits and seen exits when entering a room."""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from qff.constants import FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES
from qff.exits import exit_is_visible_to_character
from qff.models import (
    Character,
    CharacterExitSeen,
    CharacterRoomVisit,
    ItemInstance,
    Room,
    RoomBroadcast,
    RoomExit,
)
from qff.static_cache import get_room_exits_from_rooms

# Unowned floor items are deleted after this many departures from the room.
FLOOR_ITEM_NEGLECT_DELETE_AT = 4


def mark_room_visited(character: Character, room_id: int) -> None:
    CharacterRoomVisit.objects.get_or_create(
        character=character,
        room_id=room_id,
    )


def sync_seen_exits_for_character(character: Character) -> None:
    """Mark exits the character can currently see (including conditionally revealed)."""
    visited = list(
        CharacterRoomVisit.objects.filter(character=character).values_list(
            "room_id", flat=True
        )
    )
    if not visited:
        return
    visible_ids: list[int] = []
    for ex in get_room_exits_from_rooms(visited):
        if exit_is_visible_to_character(character, ex):
            visible_ids.append(ex.pk)
    if not visible_ids:
        return
    existing = set(
        CharacterExitSeen.objects.filter(
            character_id=character.pk,
            room_exit_id__in=visible_ids,
        ).values_list("room_exit_id", flat=True)
    )
    missing = [rid for rid in visible_ids if rid not in existing]
    if not missing:
        return
    CharacterExitSeen.objects.bulk_create(
        [
            CharacterExitSeen(character_id=character.pk, room_exit_id=rid)
            for rid in missing
        ],
        ignore_conflicts=True,
    )


@transaction.atomic
def on_leave_room(room_id: int) -> None:
    """When a player exits a room, bump neglect on floor loot; remove at threshold and age."""
    ItemInstance.objects.filter(
        room_id=room_id,
        owner_character__isnull=True,
        container_interactable__isnull=True,
    ).update(neglect_count=F("neglect_count") + 1)
    older_than = timezone.now() - timedelta(
        minutes=FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES
    )
    ItemInstance.objects.filter(
        room_id=room_id,
        owner_character__isnull=True,
        container_interactable__isnull=True,
        neglect_count__gte=FLOOR_ITEM_NEGLECT_DELETE_AT,
        floor_dropped_at__lte=older_than,
    ).delete()


@transaction.atomic
def on_enter_room(character: Character, room_id: int) -> None:
    mark_room_visited(character, room_id)
    sync_seen_exits_for_character(character)
    # Keep one line of room context on entry so arrivals do not miss a just-emitted
    # combat/action broadcast that raced slightly ahead of their move request.
    recent_ids = list(
        RoomBroadcast.objects.filter(room_id=room_id)
        .order_by("-id")
        .values_list("id", flat=True)[:2]
    )
    if len(recent_ids) >= 2:
        character.last_room_broadcast_id = int(recent_ids[1])
    else:
        character.last_room_broadcast_id = 0
    update_fields = ["last_room_broadcast_id", "updated_at"]
    reset_dark = (
        Room.objects.filter(pk=room_id)
        .values_list("reset_dark_lighting_on_enter", flat=True)
        .first()
    )
    if reset_dark:
        character.dark_minimap_lit_room_ids = []
        character.dark_minimap_torch_radius = None
        update_fields.extend(["dark_minimap_lit_room_ids", "dark_minimap_torch_radius"])
    character.container_focus_interactable_id = None
    character.container_focus_expires_at = None
    character.opened_container_interactable_id = None
    update_fields.extend(
        [
            "container_focus_interactable",
            "container_focus_expires_at",
            "opened_container_interactable",
        ]
    )
    character.save(update_fields=update_fields)


def mark_exit_used(character: Character, room_exit: RoomExit) -> None:
    CharacterExitSeen.objects.bulk_create(
        [
            CharacterExitSeen(
                character_id=character.pk,
                room_exit_id=room_exit.pk,
            )
        ],
        ignore_conflicts=True,
    )
