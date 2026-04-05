"""Build GET /qff/session/ JSON."""

import re
from datetime import timedelta

from django.utils import timezone

from qff.models import (
    AreaCell,
    Character,
    CharacterExitSeen,
    CharacterRoomVisit,
    RoomExit,
)

DEFAULT_THEME_PRIMARY = "#c8e6a8"
DEFAULT_THEME_SECONDARY = "#889977"
DEFAULT_THEME_ACCENT = "#e8f5c8"


def normalize_hex_color(value) -> str:
    """Accept #RGB or #RRGGBB; return lowercase #rrggbb or ''."""
    if value is None:
        return ""
    s = str(value).strip()
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", s):
        return s.lower()
    if re.fullmatch(r"#[0-9A-Fa-f]{3}", s):
        return "#" + "".join(c * 2 for c in s[1:])
    return ""


def resolved_area_theme(area) -> dict:
    return {
        "primary": area.theme_primary or DEFAULT_THEME_PRIMARY,
        "secondary": area.theme_secondary or DEFAULT_THEME_SECONDARY,
        "accent": area.theme_accent or DEFAULT_THEME_ACCENT,
    }


def others_here(character: Character) -> list[str]:
    threshold = timezone.now() - timedelta(minutes=10)
    qs = (
        Character.objects.filter(
            current_room_id=character.current_room_id,
            last_activity_at__gte=threshold,
        )
        .exclude(pk=character.pk)
        .order_by("name")
        .values_list("name", flat=True)
    )
    return list(qs)


def build_area_map(character: Character) -> dict:
    """Visited rooms per area — each grid uses that area's dimensions (multi-area travel)."""
    visited_ids = set(
        CharacterRoomVisit.objects.filter(character=character).values_list(
            "room_id", flat=True
        )
    )
    current_area = character.current_room.area
    seen_exit_ids = set(
        CharacterExitSeen.objects.filter(character=character).values_list(
            "room_exit_id", flat=True
        )
    )

    def cell_payload(room, cell) -> dict:
        exits_out = []
        for ex in RoomExit.objects.filter(from_room_id=room.id):
            if ex.id not in seen_exit_ids:
                continue
            exits_out.append(
                {
                    "direction": ex.direction,
                    "to_room_id": ex.to_room_id,
                    "to_room_name": ex.to_room.name,
                }
            )
        return {
            "x": cell.x,
            "y": cell.y,
            "room_id": room.id,
            "room_name": room.name,
            "exits": exits_out,
        }

    if not visited_ids:
        return {
            "current_area_id": current_area.id,
            "grids": [
                {
                    "area_id": current_area.id,
                    "area_name": current_area.name,
                    "grid_width": current_area.grid_width,
                    "grid_height": current_area.grid_height,
                    "cells": [],
                }
            ],
        }

    area_cells: dict[int, list] = {}
    for ac in (
        AreaCell.objects.filter(room_id__in=visited_ids)
        .select_related("room", "area")
        .order_by("area_id", "y", "x")
    ):
        area_cells.setdefault(ac.area_id, []).append(ac)

    grids = []
    for aid in sorted(
        area_cells.keys(),
        key=lambda i: (
            0 if i == current_area.id else 1,
            area_cells[i][0].area.name,
        ),
    ):
        area = area_cells[aid][0].area
        cells_out = []
        for ac in area_cells[aid]:
            cells_out.append(cell_payload(ac.room, ac))
        cells_out.sort(key=lambda c: (c["y"], c["x"]))
        grids.append(
            {
                "area_id": area.id,
                "area_name": area.name,
                "grid_width": area.grid_width,
                "grid_height": area.grid_height,
                "cells": cells_out,
            }
        )

    return {
        "current_area_id": current_area.id,
        "grids": grids,
    }


def character_profile_placeholder(character: Character) -> dict:
    return {
        "name": character.name,
        "class": {
            "slug": character.character_class.slug,
            "name": character.character_class.name,
        },
        "equipment_slots": {
            "head": None,
            "body": None,
            "hands": None,
            "feet": None,
            "accessory": None,
        },
        "inventory": [],
        "stats": {
            "gains": None,
            "moves": None,
            "guts": None,
            "smarts": None,
            "sense": None,
            "rizz": None,
        },
    }


def build_session_for_character(character: Character) -> dict:
    room = character.current_room
    area = room.area
    exits = []
    for ex in (
        RoomExit.objects.filter(from_room=room)
        .select_related("to_room")
        .order_by("direction")
    ):
        if ex.is_hidden:
            continue
        exits.append(
            {
                "direction": ex.direction,
                "label": ex.get_direction_display(),
                "to_room_id": ex.to_room_id,
            }
        )

    return {
        "has_character": True,
        "character": {
            "id": character.id,
            "name": character.name,
            "class_slug": character.character_class.slug,
            "class_name": character.character_class.name,
            "spawn_room": {
                "id": character.spawn_room_id,
                "name": character.spawn_room.name,
            },
        },
        "room": {
            "id": room.id,
            "name": room.name,
            "description": room.description,
        },
        "area": {
            "id": area.id,
            "name": area.name,
            "theme": resolved_area_theme(area),
        },
        "exits": exits,
        "others_here": others_here(character),
        "area_map": build_area_map(character),
        "character_profile": character_profile_placeholder(character),
        "action_log": [],
    }
