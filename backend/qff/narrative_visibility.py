"""Whether a room's narrative details are visible (stricter than dark minimap 'you are here' cell)."""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.utils import timezone

from qff.constants import AFK_LOBBY_KICK_MINUTES
from qff.models import Character, CharacterRoomVisit, MonsterInstance, Npc, Room

if TYPE_CHECKING:
    from qff.models import Character as CharacterType
    from qff.models import Room as RoomType


def _int_id_set(raw: list | None) -> set[int]:
    out: set[int] = set()
    for x in raw or []:
        try:
            out.add(int(x))
        except (TypeError, ValueError):
            continue
    return out


def sconce_lit_area_ids_for_character(character: CharacterType) -> set[int]:
    """Area ids where this hero used a sconce (whole area lit for narrative + minimap).

    Includes legacy data: rooms listed in ``hero_permanent_minimap_lit_room_ids`` are mapped to
    their areas so older saves still behave.
    """
    out = _int_id_set(getattr(character, "sconce_full_narrative_area_ids", None))
    hero_rooms = _int_id_set(getattr(character, "hero_permanent_minimap_lit_room_ids", None))
    if hero_rooms:
        for aid in Room.objects.filter(pk__in=hero_rooms).values_list(
            "area_id", flat=True
        ).distinct():
            out.add(int(aid))
    return out


def room_is_narratively_visible(character: CharacterType, room: RoomType) -> bool:
    """True if the hero may read room prose / directional peek for this room.

    Unlike the minimap, the current room is not implicitly lit in dark areas.
    """
    area = room.area
    if not area.is_dark_minimap:
        return True
    if int(room.area_id) in sconce_lit_area_ids_for_character(character):
        return True
    now = timezone.now()
    reveal_area_id = getattr(character, "minimap_full_reveal_area_id", None)
    reveal_until = getattr(character, "minimap_full_reveal_until", None)
    if (
        reveal_area_id == area.id
        and reveal_until
        and now < reveal_until
        and CharacterRoomVisit.objects.filter(
            character=character, room_id=room.id
        ).exists()
    ):
        return True
    if room.permanent_minimap_light:
        return True
    if room.id in _int_id_set(character.dark_minimap_lit_room_ids):
        return True
    return False


def occupant_labels_for_look(viewer: CharacterType, room_id: int) -> list[str]:
    """Monster names, NPC names, and other heroes (AFK window), for peek / look summaries."""
    now = timezone.now()
    visible_threshold = now - timedelta(minutes=AFK_LOBBY_KICK_MINUTES)
    labels: list[str] = []
    for m in (
        MonsterInstance.objects.filter(current_room_id=room_id)
        .select_related("template")
        .order_by("id")
    ):
        labels.append(m.template.name)
    for n in Npc.objects.filter(room_id=room_id).order_by("name"):
        labels.append(n.name)
    for name, la in (
        Character.objects.filter(current_room_id=room_id)
        .exclude(pk=viewer.pk)
        .order_by("name")
        .values_list("name", "last_activity_at")
    ):
        if la and la >= visible_threshold:
            labels.append(name)
    return labels
