"""Build GET /qff/session/ JSON."""

import re
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from qff.constants import AFK_LOBBY_KICK_MINUTES, PRESENCE_MINUTES
from qff.exploration import sync_seen_exits_for_character
from qff.narrative_visibility import (
    room_is_narratively_visible,
    sconce_lit_area_ids_for_character,
)
from qff.exits import (
    exit_appears_locked_for_display,
    exit_is_passable,
    exit_is_visible_to_character,
)
from qff.quest_engine import (
    floor_item_visible_to_character,
    room_item_visible_to_character,
    sync_character_world_before_session,
    unowned_floor_item_template_ids_in_room,
)
from qff.game_helpers import (
    display_name_for_instance,
    encumbrance_excess,
    inventory_stack_label,
    modified_stats,
    stat_bonus_totals,
    total_armor_from_equipment,
)
from qff.models import (
    AreaCell,
    Character,
    CharacterExitSeen,
    CharacterQuestProgress,
    CharacterRoomSearchClaim,
    CharacterRoomVisit,
    Interactable,
    ItemInstance,
    MonsterInstance,
    Npc,
    NpcShopStockLine,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
    RoomItem,
)
from qff.shop_engine import get_enabled_shops_in_room


def _opened_container_session_dict(character: Character, room: Room) -> dict | None:
    cid = getattr(character, "opened_container_interactable_id", None)
    if not cid:
        return None
    obj = Interactable.objects.filter(pk=cid, room_id=room.id).first()
    if not obj:
        return None
    items: list[dict] = []
    for inst in (
        ItemInstance.objects.filter(
            room_id=room.id,
            container_interactable_id=cid,
            owner_character__isnull=True,
        )
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not floor_item_visible_to_character(character, inst):
            continue
        items.append(
            {
                "id": inst.id,
                "name": display_name_for_instance(inst),
                "quantity": max(1, int(inst.quantity or 1)),
            }
        )
    floor_ids = unowned_floor_item_template_ids_in_room(room.id)
    for ri in (
        RoomItem.objects.filter(room_id=room.id, interactable_id=cid)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not room_item_visible_to_character(character, ri, floor_ids):
            continue
        label = ri.nickname if ri.nickname else ri.item.name
        # Negative id namespaces RoomItem slots vs ItemInstance pks in the same JSON list.
        items.append({"id": -ri.id, "name": label, "quantity": 1})
    return {"id": obj.id, "slug": obj.slug, "name": obj.name, "items": items}

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


def others_here_detailed(character) -> list[dict]:
    """Other heroes in the room who have issued a command within the AFK window.

    Characters with no recent input (beyond ``AFK_LOBBY_KICK_MINUTES``) are omitted — they are
    not treated as present in the realm for this HUD. Among those listed, ``inactive`` is True
    if their last command was more than ``PRESENCE_MINUTES`` ago.
    """
    now = timezone.now()
    inactive_threshold = now - timedelta(minutes=PRESENCE_MINUTES)
    visible_threshold = now - timedelta(minutes=AFK_LOBBY_KICK_MINUTES)
    qs = (
        Character.objects.filter(
            current_room_id=character.current_room_id,
            is_in_realm=True,
        )
        .exclude(pk=character.pk)
        .order_by("name")
        .values_list("name", "last_activity_at")
    )
    out: list[dict] = []
    for name, la in qs:
        if not la or la < visible_threshold:
            continue
        inactive = la < inactive_threshold
        out.append({"name": name, "inactive": inactive})
    return out


def active_heroes_in_realm() -> list[dict]:
    """All in-realm heroes with recent input (same visibility window as ``others_here``).

    Each item has name, level, class_name, and area_name only (no room or other details).
    """
    now = timezone.now()
    visible_threshold = now - timedelta(minutes=AFK_LOBBY_KICK_MINUTES)
    qs = (
        Character.objects.filter(
            is_in_realm=True,
            last_activity_at__gte=visible_threshold,
        )
        .select_related("current_room__area", "character_class")
        .order_by("name")
    )
    return [
        {
            "name": c.name,
            "level": c.level,
            "class_name": c.character_class.name,
            "area_name": c.current_room.area.name,
        }
        for c in qs
    ]


def _character_is_inactive_for_hud(character) -> bool:
    la = character.last_activity_at
    if not la:
        return True
    return la < timezone.now() - timedelta(minutes=PRESENCE_MINUTES)


def _force_lobby_for_inactivity(character) -> bool:
    if not getattr(character, "is_in_realm", True):
        return True
    la = character.last_activity_at
    if not la:
        return True
    if la >= timezone.now() - timedelta(minutes=AFK_LOBBY_KICK_MINUTES):
        return False
    # AFK threshold crossed: eagerly run the same completion as /leave so peers stop
    # seeing this character and monsters drop aggro before the next sim tick.
    from qff.monster_sim import _boot_hero_to_lobby

    _boot_hero_to_lobby(character)
    character.is_in_realm = False
    return True


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
    out = [
        {"id": b.id, "text": b.text, "log_tone": (b.log_tone or "").strip()}
        for b in rows
    ]
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
    sconce_areas = sconce_lit_area_ids_for_character(character)
    temp_minimap_lit: set[int] = set()
    for x in character.dark_minimap_lit_room_ids or []:
        try:
            temp_minimap_lit.add(int(x))
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
        effective_dark = current_area.is_dark_minimap and current_area.id not in sconce_areas
        lit_here = permanent_minimap_by_area[current_area.id] | {character.current_room_id}
        if effective_dark:
            lit_here |= temp_minimap_lit
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
                    "is_dark_minimap": effective_dark,
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
        effective_dark = area.is_dark_minimap and area.id not in sconce_areas
        lit_here = (temp_minimap_lit & visited_in_area) | permanent_minimap_by_area[area.id]
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
                "is_dark_minimap": effective_dark,
                "lit_room_ids": sorted(lit_here),
                "visited_room_ids": sorted(visited_in_area),
                "map_full_reveal_active": map_reveal,
            }
        )

    return {
        "current_area_id": current_area.id,
        "grids": grids,
    }


def _slot_label(character, inst) -> str | None:
    if inst is None:
        return None
    return inventory_stack_label(inst, include_lock_hint=True, character=character)


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
            labels.append(inventory_stack_label(inst, include_lock_hint=True, character=character))
            quantities.append(max(1, int(inst.quantity or 1)))
    return labels, quantities


def _inventory_item_labels(character) -> list[str]:
    return _inventory_display_rows(character)[0]


def _room_floor_labels(room_id: int, character) -> list[str]:
    counts: dict[str, int] = {}
    for inst in (
        ItemInstance.objects.filter(
            room_id=room_id,
            owner_character__isnull=True,
            container_interactable__isnull=True,
        )
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not floor_item_visible_to_character(character, inst):
            continue
        base = display_name_for_instance(inst)
        qty = max(1, int(inst.quantity or 1))
        counts[base] = counts.get(base, 0) + qty
    out: list[str] = []
    for base, qty in counts.items():
        if qty > 1:
            out.append(f"{base} ({qty})")
        else:
            out.append(base)
    return out


def _room_item_labels(
    room_id: int, character, floor_template_ids: set[int]
) -> list[str]:
    """Room slots (mint-on-get); labels after floor items, same display pattern as floor."""
    out: list[str] = []
    for ri in (
        RoomItem.objects.filter(room_id=room_id, interactable__isnull=True)
        .select_related("item", "visible_quest_state")
        .order_by("id")
    ):
        if not room_item_visible_to_character(character, ri, floor_template_ids):
            continue
        out.append(ri.nickname if ri.nickname else ri.item.name)
    return out


def _room_gold_pile_labels(room_id: int) -> list[str]:
    """Unpicked gold on the floor (aggregated; no source labels)."""
    total = 0
    for p in RoomGoldPile.objects.filter(room_id=room_id, amount_remaining__gt=0):
        total += int(p.amount_remaining)
    if total <= 0:
        return []
    return [f"{total} gold"]


def _room_gold_piles_json(room_id: int) -> list[dict]:
    piles = list(RoomGoldPile.objects.filter(room_id=room_id).order_by("id"))
    if not piles:
        return []
    total = sum(int(p.amount_remaining) for p in piles if int(p.amount_remaining) > 0)
    if total <= 0:
        return []
    return [{"id": piles[0].id, "amount": total, "label": ""}]


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
        "isInactive": _character_is_inactive_for_hud(character),
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
            "head": _slot_label(character, character.head_item),
            "mainHand": _slot_label(character, character.main_hand_item),
            "offHand": _slot_label(character, character.off_hand_item),
            "chest": _slot_label(character, character.chest_item),
            "feet": _slot_label(character, character.feet_item),
            "ring": _slot_label(character, character.ring_item),
            "amulet": _slot_label(character, character.amulet_item),
        },
        "inventory": inv_ids,
        "inventoryItems": inv_labels,
        "inventoryQuantities": inv_quantities,
        "stats": {
            "base": base,
            "modified": mod,
            "bonusSum": bonus,
        },
        "isEncumbered": encumbrance_excess(character) > 0,
    }


def _shops_in_room_json(room_id: int) -> list[dict]:
    """Current-room shops for the play UI's shop panel. Mirrors `browse_shop` data, in structured form."""
    out: list[dict] = []
    for shop in get_enabled_shops_in_room(room_id):
        lines_out: list[dict] = []
        for sl in (
            NpcShopStockLine.objects.filter(shop=shop)
            .select_related("item", "consignment_item_instance")
            .order_by("sort_order", "id")
        ):
            inst = sl.consignment_item_instance
            if sl.kind == NpcShopStockLine.Kind.CONSIGNMENT and inst is not None:
                name = display_name_for_instance(inst)
                qty = int(inst.quantity or 1)
            else:
                name = sl.item.name
                qty = sl.quantity
            if qty is not None and int(qty) < 1:
                continue
            lines_out.append(
                {
                    "id": sl.id,
                    "item_id": sl.item_id,
                    "name": name,
                    "kind": sl.kind,
                    "price": int(sl.price),
                    "quantity": qty,
                }
            )
        out.append(
            {
                "id": shop.id,
                "npc_id": shop.npc_id,
                "npc_name": shop.npc.name,
                "welcome_text": shop.welcome_text or "",
                "stock_lines": lines_out,
            }
        )
    return out


def _active_quests_json(character: Character) -> list[dict]:
    """In-progress quest states (non-terminal) for the play UI quest panel — state label only."""
    out: list[dict] = []
    for cqp in (
        CharacterQuestProgress.objects.filter(
            character=character,
            current_state__is_terminal=False,
        )
        .select_related("current_state")
        .order_by("current_state__name", "current_state__slug", "id")
    ):
        st = cqp.current_state
        name = (st.name or "").strip()
        label = name if name else (st.slug or f"state-{st.pk}")
        out.append({"label": label, "slug": st.slug})
    return out


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
                "is_locked": exit_appears_locked_for_display(character, ex),
            }
        )

    action_log = consume_room_broadcast_entries(character)

    room_interactables = list(
        Interactable.objects.filter(room_id=room.id).order_by("name")
    )
    you_see = [o.name for o in room_interactables] + _room_you_see_tail_labels(
        room.id, character
    )
    details_visible = room_is_narratively_visible(character, room)
    room_description = room.description
    if details_visible:
        unlocked_text = (room.search_text or "").strip()
        if unlocked_text:
            searched = (
                CharacterRoomSearchClaim.objects.filter(
                    character_id=character.pk,
                    room_id=room.pk,
                    successful_search=True,
                )
                .values_list("id", flat=True)
                .first()
            )
            if searched:
                room_description = (room_description or "").rstrip()
                if room_description:
                    room_description += "\n"
                room_description += unlocked_text

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
            "description": room_description,
            "details_visible": details_visible,
            "opened_container": _opened_container_session_dict(character, room),
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
            "gold_piles": _room_gold_piles_json(room.id),
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
        "others_here": others_here_detailed(character),
        "active_heroes": active_heroes_in_realm(),
        "force_lobby": _force_lobby_for_inactivity(character),
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
        "shops": _shops_in_room_json(room.id),
        "active_quests": _active_quests_json(character),
        "pending_prompt": getattr(character, "pending_prompt", None) or None,
    }
