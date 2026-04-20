"""Build GET /qff/session/ JSON."""

import re
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from qff.constants import PRESENCE_MINUTES
from qff.exploration import sync_seen_exits_for_character
from qff.exits import exit_is_passable, exit_is_visible_to_character
from qff.quest_engine import (
    floor_item_visible_to_character,
    room_item_visible_to_character,
    sync_character_world_before_session,
    unowned_floor_item_template_ids_in_room,
)
from qff.game_helpers import (
    display_name_for_instance,
    inventory_stack_label,
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
    MonsterInstance,
    Npc,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
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


def consume_room_broadcast_entries(character) -> list[dict]:
    """Return new room broadcasts as ``{id, text}`` and advance ``last_room_broadcast_id``."""
    qs = (
        RoomBroadcast.objects.filter(
            room_id=character.current_room_id,
            id__gt=character.last_room_broadcast_id,
        )
        .filter(Q(target_character_id__isnull=True) | Q(target_character_id=character.pk))
        .exclude(speaker_id=character.pk)
        .order_by("id")
    )
    rows = list(qs)
    out = [{"id": b.id, "text": b.text} for b in rows]
    if rows:
        character.last_room_broadcast_id = rows[-1].id
        character.save(update_fields=["last_room_broadcast_id", "updated_at"])
    return out


def consume_room_broadcasts(character) -> list[str]:
    """Return new broadcast lines only (see ``consume_room_broadcast_entries`` for ids)."""
    return [str(e["text"]) for e in consume_room_broadcast_entries(character)]


def build_area_map(character) -> dict:
    """Visited rooms per area — each grid uses that area's dimensions (multi-area travel)."""
    sync_seen_exits_for_character(character)
    now = timezone.now()
    visited_ids = set(
        CharacterRoomVisit.objects.filter(character=character).values_list(
            "room_id", flat=True
        )
    )
    current_area = character.current_room.area
    temp_minimap_lit: set[int] = set()
    for x in character.dark_minimap_lit_room_ids or []:
        try:
            temp_minimap_lit.add(int(x))
        except (TypeError, ValueError):
            continue

    hero_perm_lit: set[int] = set()
    for x in character.hero_permanent_minimap_lit_room_ids or []:
        try:
            hero_perm_lit.add(int(x))
        except (TypeError, ValueError):
            continue

    permanent_minimap_by_area: dict[int, set[int]] = defaultdict(set)
    for rid, aid in Room.objects.filter(permanent_minimap_light=True).values_list(
        "id", "area_id"
    ):
        permanent_minimap_by_area[aid].add(rid)
    seen_exit_ids = set(
        CharacterExitSeen.objects.filter(character=character).values_list(
            "room_exit_id", flat=True
        )
    )

    exits_by_from: dict[int, list[RoomExit]] = defaultdict(list)
    if visited_ids:
        for ex in (
            RoomExit.objects.filter(from_room_id__in=visited_ids)
            .select_related("to_room")
            .order_by("from_room_id", "id")
        ):
            exits_by_from[ex.from_room_id].append(ex)

    def cell_payload(room, cell) -> dict:
        exits_out = []
        for ex in exits_by_from.get(room.id, ()):
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
        lit_here = (
            permanent_minimap_by_area[current_area.id]
            | (hero_perm_lit & {character.current_room_id})
            | {character.current_room_id}
        )
        visited_here = [character.current_room_id]
        map_reveal = bool(
            character.minimap_full_reveal_area_id == current_area.id
            and character.minimap_full_reveal_until
            and now < character.minimap_full_reveal_until
        )
        return {
            "current_area_id": current_area.id,
            "grids": [
                {
                    "area_id": current_area.id,
                    "area_name": current_area.name,
                    "grid_width": current_area.grid_width,
                    "grid_height": current_area.grid_height,
                    "cells": [],
                    "is_dark_minimap": current_area.is_dark_minimap,
                    "lit_room_ids": sorted(lit_here),
                    "visited_room_ids": visited_here,
                    "map_full_reveal_active": map_reveal,
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
        visited_in_area = {c["room_id"] for c in cells_out}
        lit_here = (
            (temp_minimap_lit & visited_in_area)
            | permanent_minimap_by_area[area.id]
            | (hero_perm_lit & visited_in_area)
        )
        if character.current_room.area_id == area.id:
            lit_here = lit_here | {character.current_room_id}
        map_reveal = bool(
            character.minimap_full_reveal_area_id == area.id
            and character.minimap_full_reveal_until
            and now < character.minimap_full_reveal_until
        )
        grids.append(
            {
                "area_id": area.id,
                "area_name": area.name,
                "grid_width": area.grid_width,
                "grid_height": area.grid_height,
                "cells": cells_out,
                "is_dark_minimap": area.is_dark_minimap,
                "lit_room_ids": sorted(lit_here),
                "visited_room_ids": sorted(visited_in_area),
                "map_full_reveal_active": map_reveal,
            }
        )

    return {
        "current_area_id": current_area.id,
        "grids": grids,
    }


def _slot_label(inst) -> str | None:
    if inst is None:
        return None
    return inventory_stack_label(inst, include_lock_hint=True)


def _inventory_display_rows(character) -> tuple[list[str], list[int]]:
    """Labels and parallel quantities (index 0 = most recently stowed)."""
    inv_ids = list(character.inventory or [])
    if not inv_ids:
        return [], []
    by_id = {
        i.id: i
        for i in ItemInstance.objects.filter(
            pk__in=inv_ids,
            owner_character_id=character.pk,
        ).select_related("item")
    }
    labels: list[str] = []
    quantities: list[int] = []
    for iid in inv_ids:
        inst = by_id.get(iid)
        if inst:
            labels.append(inventory_stack_label(inst, include_lock_hint=True))
            quantities.append(max(1, int(inst.quantity or 1)))
    return labels, quantities


def _inventory_item_labels(character) -> list[str]:
    return _inventory_display_rows(character)[0]


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


def _room_gold_pile_labels(room_id: int) -> list[str]:
    """Unpicked gold on the floor (monster drops, death tolls, etc.)."""
    out: list[str] = []
    for p in RoomGoldPile.objects.filter(
        room_id=room_id, amount_remaining__gt=0
    ).order_by("id"):
        amt = int(p.amount_remaining)
        lab = (p.label or "").strip()
        if lab:
            out.append(f"{amt} gold ({lab})")
        else:
            out.append(f"{amt} gold")
    return out


def _room_you_see_tail_labels(room_id: int, character) -> list[str]:
    """Gold piles, floor instances, and room item slots (after interactable names in the HUD)."""
    floor_template_ids = unowned_floor_item_template_ids_in_room(room_id)
    return (
        _room_gold_pile_labels(room_id)
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
    inv_labels, inv_quantities = _inventory_display_rows(character)
    return {
        "name": character.name,
        "level": character.level,
        "xp": character.xp,
        "gold": character.gold,
        "isDead": character.is_dead,
        "unspentStatPoints": character.unspent_stat_points,
        "nextCombatAt": (
            character.next_action_at.isoformat() if character.next_action_at else None
        ),
        "curHealth": character.cur_health,
        "maxHealth": character.max_health,
        "curMana": character.cur_mana,
        "maxMana": character.max_mana,
        "armorTotal": total_armor_from_equipment(character),
        "class": {
            "slug": character.character_class.slug,
            "name": character.character_class.name,
        },
        "glyphs": list(character.glyphs or []),
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
        "inventoryItems": inv_labels,
        "inventoryQuantities": inv_quantities,
        "stats": {
            "base": base,
            "modified": mod,
            "bonusSum": bonus,
        },
    }


def build_session_for_character(character, *, world_sync: bool = True) -> dict:
    # Costly: minimap, exits, inventory. ``qff.views.command_view`` logs ``session_ms`` for profiling.
    if world_sync:
        character = sync_character_world_before_session(character)
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

    action_log = consume_room_broadcast_entries(character)

    room_interactables = list(
        Interactable.objects.filter(room_id=room.id).order_by("name")
    )
    you_see = [o.name for o in room_interactables] + _room_you_see_tail_labels(
        room.id, character
    )

    return {
        "has_character": True,
        "character": {
            "id": character.id,
            "name": character.name,
            "class_slug": character.character_class.slug,
            "class_name": character.character_class.name,
            "glyphs": list(character.glyphs or []),
            "spawn_room": {
                "id": character.spawn_room_id,
                "name": character.spawn_room.name,
            },
        },
        "room": {
            "id": room.id,
            "name": room.name,
            "description": room.description,
            "is_safe": room.is_safe,
            "is_spawn_point": room.is_spawn_point,
            "monsters": [
                {
                    "id": m.id,
                    "slug": m.template.slug,
                    "name": m.template.name,
                    "cur_hp": m.cur_hp,
                    "max_hp": m.max_hp,
                }
                for m in MonsterInstance.objects.filter(current_room_id=room.id)
                .select_related("template")
                .order_by("id")
            ],
            "gold_piles": [
                {"id": p.id, "amount": p.amount_remaining, "label": p.label}
                for p in RoomGoldPile.objects.filter(room_id=room.id).order_by("id")
            ],
            "youSee": you_see,
            "npcs": [
                {"slug": n.slug, "name": n.name}
                for n in Npc.objects.filter(room_id=room.id).order_by("name")
            ],
            "interactables": [
                {"slug": o.slug, "name": o.name, "kind": o.kind}
                for o in room_interactables
            ],
        },
        "area": {
            "id": area.id,
            "name": area.name,
            "theme": resolved_area_theme(area),
        },
        "exits": exits,
        "others_here": others_here(character),
        "area_map": (
            {
                "current_area_id": area.id,
                "grids": [],
                "minimal": True,
            }
            if getattr(settings, "QFF_SESSION_MINIMAL_AREA_MAP", False)
            else build_area_map(character)
        ),
        "character_profile": build_character_profile(character),
        "action_log": action_log,
    }
