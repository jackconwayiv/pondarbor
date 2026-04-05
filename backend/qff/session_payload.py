"""Build GET /qff/session/ JSON."""

import re
from datetime import timedelta

from django.utils import timezone

from qff.constants import PRESENCE_MINUTES
from qff.exploration import sync_seen_exits_for_character
from qff.exits import exit_is_passable, exit_is_visible_to_character
from qff.quest_engine import (
    floor_item_visible_to_character,
    room_item_visible_to_character,
    unowned_floor_item_template_ids_in_room,
)
from qff.game_helpers import (
    display_name_for_instance,
    modified_stats,
    stat_bonus_totals,
    total_armor_from_equipment,
)
from qff.models import (
    AreaCell,
    Character,
    CharacterExitSeen,
    CharacterRoomVisit,
    Interactable,
    ItemInstance,
    Npc,
    RoomBroadcast,
    RoomExit,
    RoomItem,
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


def others_here(character) -> list[str]:
    threshold = timezone.now() - timedelta(minutes=PRESENCE_MINUTES)
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


def consume_room_broadcasts(character) -> list[str]:
    """Return new broadcast lines for this character and advance cursor."""
    qs = (
        RoomBroadcast.objects.filter(
            room_id=character.current_room_id,
            id__gt=character.last_room_broadcast_id,
        )
        .exclude(speaker_id=character.pk)
        .order_by("id")
    )
    rows = list(qs)
    lines = [b.text for b in rows]
    if rows:
        character.last_room_broadcast_id = rows[-1].id
        character.save(update_fields=["last_room_broadcast_id", "updated_at"])
    return lines


def build_area_map(character) -> dict:
    """Visited rooms per area — each grid uses that area's dimensions (multi-area travel)."""
    sync_seen_exits_for_character(character)
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


def _slot_label(inst) -> str | None:
    if inst is None:
        return None
    return display_name_for_instance(inst, include_lock_hint=True)


def _inventory_item_labels(character) -> list[str]:
    """Names in inventory order (index 0 = most recently stowed)."""
    inv_ids = list(character.inventory or [])
    if not inv_ids:
        return []
    by_id = {
        i.id: i
        for i in ItemInstance.objects.filter(
            pk__in=inv_ids,
            owner_character_id=character.pk,
        ).select_related("item")
    }
    out = []
    for iid in inv_ids:
        inst = by_id.get(iid)
        if inst:
            out.append(display_name_for_instance(inst, include_lock_hint=True))
    return out


def _room_floor_labels(room_id: int, character) -> list[str]:
    out: list[str] = []
    for inst in (
        ItemInstance.objects.filter(
            room_id=room_id,
            owner_character__isnull=True,
        )
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not floor_item_visible_to_character(character, inst):
            continue
        out.append(display_name_for_instance(inst))
    return out


def _room_item_labels(
    room_id: int, character, floor_template_ids: set[int]
) -> list[str]:
    """Room slots (mint-on-get); labels after floor items, same display pattern as floor."""
    out: list[str] = []
    for ri in (
        RoomItem.objects.filter(room_id=room_id)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not room_item_visible_to_character(character, ri, floor_template_ids):
            continue
        out.append(ri.nickname if ri.nickname else ri.item.name)
    return out


def _room_you_see_labels(room_id: int, character) -> list[str]:
    """Interactable names first, then floor instances, then room item slots (matches play HUD order)."""
    floor_template_ids = unowned_floor_item_template_ids_in_room(room_id)
    interact = [
        o.name
        for o in Interactable.objects.filter(room_id=room_id).order_by("name")
    ]
    return (
        interact
        + _room_floor_labels(room_id, character)
        + _room_item_labels(room_id, character, floor_template_ids)
    )


def build_character_profile(character) -> dict:
    base = {
        "gains": character.gains,
        "moves": character.moves,
        "guts": character.guts,
        "smarts": character.smarts,
        "sense": character.sense,
        "rizz": character.rizz,
    }
    mod = modified_stats(character)
    bonus = stat_bonus_totals(character)
    inv_ids = list(character.inventory or [])
    return {
        "name": character.name,
        "level": character.level,
        "xp": character.xp,
        "gold": character.gold,
        "curHealth": character.cur_health,
        "maxHealth": character.max_health,
        "curMana": character.cur_mana,
        "maxMana": character.max_mana,
        "armorTotal": total_armor_from_equipment(character),
        "class": {
            "slug": character.character_class.slug,
            "name": character.character_class.name,
        },
        "equipment_slots": {
            "head": _slot_label(character.head_item),
            "mainHand": _slot_label(character.main_hand_item),
            "offHand": _slot_label(character.off_hand_item),
            "chest": _slot_label(character.chest_item),
            "feet": _slot_label(character.feet_item),
            "ring": _slot_label(character.ring_item),
            "amulet": _slot_label(character.amulet_item),
        },
        "inventory": inv_ids,
        "inventoryItems": _inventory_item_labels(character),
        "stats": {
            "base": base,
            "modified": mod,
            "bonusSum": bonus,
        },
    }


def build_session_for_character(character) -> dict:
    room = character.current_room
    area = room.area
    exits = []
    for ex in (
        RoomExit.objects.filter(from_room=room)
        .select_related(
            "to_room",
            "quest_required_state",
            "key_item",
            "reveal_item",
            "reveal_quest_state",
        )
        .order_by("direction")
    ):
        if not exit_is_visible_to_character(character, ex):
            continue
        exits.append(
            {
                "direction": ex.direction,
                "label": ex.get_direction_display(),
                "to_room_id": ex.to_room_id,
                "is_blocked": not exit_is_passable(character, ex),
            }
        )

    action_log = consume_room_broadcasts(character)

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
            "youSee": _room_you_see_labels(room.id, character),
            "npcs": [
                {"slug": n.slug, "name": n.name}
                for n in Npc.objects.filter(room_id=room.id).order_by("name")
            ],
            "interactables": [
                {"slug": o.slug, "name": o.name, "kind": o.kind}
                for o in Interactable.objects.filter(room_id=room.id).order_by("name")
            ],
        },
        "area": {
            "id": area.id,
            "name": area.name,
            "theme": resolved_area_theme(area),
        },
        "exits": exits,
        "others_here": others_here(character),
        "area_map": build_area_map(character),
        "character_profile": build_character_profile(character),
        "action_log": action_log,
    }
