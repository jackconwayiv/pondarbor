import json
import logging
import time

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser, IsStaffUser

from qff.command_echo import should_echo_command
from qff.command_handlers import execute_command, maybe_handle_pending_prompt
from qff.command_parser import ParsedLeave, parse_command
from qff.exploration import on_enter_room
from qff.loadout import apply_starting_loadout
from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    Interactable,
    Item,
    ItemInstance,
    MonsterTemplate,
    Quest,
    QuestState,
    QffIneffectiveInput,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomItem,
    validate_character_name,
)
from qff.constants import (
    DEFAULT_START_AREA_FALLBACK_NAMES,
    DEFAULT_START_AREA_SLUGS,
    DEFAULT_START_ROOM_NAME,
    DEFAULT_START_ROOM_SLUG,
    LEGACY_START_AREA_FALLBACK_NAMES,
    LEGACY_START_AREA_SLUGS,
    LEGACY_START_ROOM_NAME,
    LEGACY_START_ROOM_SLUG,
)
from qff.game_helpers import encumbrance_excess
from qff.ensure_glyph_character_class import ensure_glyph_character_class
from qff.glyph_class_map import normalize_glyphs, slug_for_glyphs
from qff.monster_sim import run_lazy_simulation
from qff.quest_engine import sync_character_world_before_session
from qff.realtime import schedule_notify_qff_rooms
from qff.session_payload import (
    build_session_for_character,
    normalize_hex_color,
    resolved_area_theme,
)

logger = logging.getLogger(__name__)


def _get_character(user):
    try:
        return Character.objects.select_related(
            "character_class",
            "current_room",
            "current_room__area",
            "spawn_room",
            "head_item__item",
            "main_hand_item__item",
            "off_hand_item__item",
            "chest_item__item",
            "feet_item__item",
            "ring_item__item",
            "amulet_item__item",
        ).get(user=user)
    except Character.DoesNotExist:
        return None


def _get_character_by_pk(pk: int):
    """Same query shape as :func:`_get_character` for session rebuild by primary key."""
    try:
        return Character.objects.select_related(
            "character_class",
            "current_room",
            "current_room__area",
            "spawn_room",
            "head_item__item",
            "main_hand_item__item",
            "off_hand_item__item",
            "chest_item__item",
            "feet_item__item",
            "ring_item__item",
            "amulet_item__item",
        ).get(pk=pk)
    except Character.DoesNotExist:
        return None


def _action_log_entry_id(entry) -> int:
    if not isinstance(entry, dict):
        return 0
    raw = entry.get("id")
    if raw is None:
        return 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def session_view(request):
    char = _get_character(request.user)
    if not char:
        return Response({"has_character": False})
    return Response(build_session_for_character(char))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def session_activity_view(request):
    """Refresh ``last_activity_at`` (GET /session/ does not). Used when entering play after lobby."""
    char = _get_character(request.user)
    if not char:
        return Response({"ok": False}, status=status.HTTP_404_NOT_FOUND)
    now = timezone.now()
    Character.objects.filter(pk=char.pk).update(
        last_activity_at=now,
        is_in_realm=True,
        updated_at=now,
    )
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def session_leave_view(request):
    """Queue a return to lobby. Safe rooms (or no aggro) leave immediately; else a 6s delay."""
    char = _get_character(request.user)
    if not char:
        return Response({"ok": False}, status=status.HTTP_404_NOT_FOUND)
    messages = execute_command(char, ParsedLeave())
    run_lazy_simulation(notify_rooms=False)
    char.refresh_from_db()
    pending = char.pending_leave_at is not None and char.is_in_realm
    wait_seconds = 0
    if pending and char.pending_leave_at is not None:
        delta = (char.pending_leave_at - timezone.now()).total_seconds()
        wait_seconds = max(0, int(round(delta)))
    return Response(
        {
            "ok": True,
            "pending": pending,
            "wait_seconds": wait_seconds,
            "in_realm": bool(char.is_in_realm),
            "messages": messages,
        }
    )


def _pick_hub_start_room(
    qs,
    *,
    area_slugs: tuple[str, ...],
    room_name: str,
    room_slug: str,
    area_fallback_names: tuple[str, ...],
):
    """Match hub room by area slug(s), case-insensitive name, canonical room slug, or area display name."""
    rn = (room_name or "").strip()
    rs = (room_slug or "").strip()
    if not rn:
        return None
    for area_slug in area_slugs:
        slug = (area_slug or "").strip()
        if not slug:
            continue
        hit = qs.filter(area__slug=slug, name=rn).first()
        if hit:
            return hit
        hit = qs.filter(area__slug=slug, name__iexact=rn).first()
        if hit:
            return hit
        if rs:
            hit = qs.filter(area__slug=slug, slug=rs).first()
            if hit:
                return hit
            hit = qs.filter(area__slug=slug, slug__iexact=rs).first()
            if hit:
                return hit
    for an in area_fallback_names:
        label = (an or "").strip()
        if not label:
            continue
        hit = qs.filter(area__name__iexact=label, name__iexact=rn).first()
        if hit:
            return hit
    return None


def _starting_room():
    """Pick the room for new characters: primary world start, then legacy demo seed, else first room.

    Staff should mark the default start room with **Spawn point** in the DM editor so
    death/revival tracks the same hub (`Room.is_spawn_point` → `Character.spawn_room`).
    """
    qs = Room.objects.select_related("area")
    hit = _pick_hub_start_room(
        qs,
        area_slugs=DEFAULT_START_AREA_SLUGS,
        room_name=DEFAULT_START_ROOM_NAME,
        room_slug=DEFAULT_START_ROOM_SLUG,
        area_fallback_names=DEFAULT_START_AREA_FALLBACK_NAMES,
    )
    if hit:
        return hit
    hit = _pick_hub_start_room(
        qs,
        area_slugs=LEGACY_START_AREA_SLUGS,
        room_name=LEGACY_START_ROOM_NAME,
        room_slug=LEGACY_START_ROOM_SLUG,
        area_fallback_names=LEGACY_START_AREA_FALLBACK_NAMES,
    )
    if hit:
        return hit
    return qs.order_by("pk").first()


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def character_create(request):
    if request.method == "DELETE":
        char = _get_character(request.user)
        if not char:
            return Response(
                {"detail": "No character."},
                status=status.HTTP_404_NOT_FOUND,
            )
        char.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if _get_character(request.user):
        return Response(
            {"detail": "You already have a character.", "code": "character_exists"},
            status=status.HTTP_409_CONFLICT,
        )

    body = request.data
    name = (body.get("name") or "").strip()
    glyphs_payload = body.get("glyphs")
    glyphs_to_store: list[str] = []

    if glyphs_payload is not None:
        norm = normalize_glyphs(glyphs_payload if isinstance(glyphs_payload, list) else None)
        if not norm:
            return Response(
                {"detail": "Invalid glyphs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resolved_slug = slug_for_glyphs(norm[0], norm[1])
        if not resolved_slug:
            return Response(
                {"detail": "Invalid glyph combination."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        class_slug = resolved_slug
        glyphs_to_store = [norm[0], norm[1]]
    else:
        class_slug = (body.get("character_class") or body.get("class") or "").strip()
        if not class_slug:
            return Response(
                {"detail": "Provide glyphs or character_class."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        validate_character_name(name)
    except ValidationError as e:
        msg = e.messages[0] if e.messages else "Invalid name."
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

    cc = CharacterClass.objects.filter(slug=class_slug).first()
    if not cc:
        cc = ensure_glyph_character_class(class_slug)
    if not cc:
        return Response(
            {"detail": "Invalid character class."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    room = _starting_room()
    if not room:
        return Response(
            {
                "detail": "No rooms available yet. Staff must create an area and at least one room "
                "in the DM editor before new characters can start.",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        with transaction.atomic():
            char = Character(
                user=request.user,
                name=name.strip(),
                character_class=cc,
                current_room=room,
                spawn_room=room,
                last_activity_at=now,
                glyphs=glyphs_to_store,
            )
            char.save()
            on_enter_room(char, room.id)
            apply_starting_loadout(char)
    except IntegrityError:
        return Response(
            {"detail": "That name is already taken."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    char = _get_character(request.user)
    return Response(build_session_for_character(char), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def command_view(request):
    char = _get_character(request.user)
    if not char:
        return Response(
            {"detail": "No character."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    line = (request.data.get("line") or "").strip()
    if not line:
        return Response(
            {
                "messages": ["Type a command."],
                "session": build_session_for_character(char),
                "echo_command": True,
            },
        )

    character_pk = char.pk
    command_room = char.current_room
    command_room_name = (command_room.name or "").strip()[:200]
    old_room_id = char.current_room_id
    wall_start = time.perf_counter()

    try:
        with transaction.atomic():
            t_sync = time.perf_counter()
            char = sync_character_world_before_session(char)
            sync_ms = (time.perf_counter() - t_sync) * 1000
            # Service-NPC y/n prompt (healer_pay / innkeeper_stay) consumes the next
            # command when set; non-y/n clears the prompt and falls through to parse.
            prompt_messages = maybe_handle_pending_prompt(char, line)
            if prompt_messages is not None:
                parsed = None
                messages = list(prompt_messages)
                exec_ms = 0.0
            else:
                parsed = parse_command(line)
                t0 = time.perf_counter()
                messages = list(execute_command(char, parsed, world_sync=False))
                exec_ms = (time.perf_counter() - t0) * 1000
            echo_command = should_echo_command(parsed, messages)
            if messages and messages[0] == "You try that, but nothing happens.":
                email = (request.user.email or "").strip()
                QffIneffectiveInput.objects.create(
                    user=request.user,
                    user_email=email[:254] if email else "",
                    raw_line=line,
                    room=command_room,
                    room_name=command_room_name,
                )
            # Max broadcast id after execute_command, before lazy sim — splits ambient/exec vs combat sim.
            max_after_exec = RoomBroadcast.objects.aggregate(m=Max("id"))["m"] or 0
            char = _get_character(request.user)
            if char is None:
                char = _get_character_by_pk(character_pk)
            affected: list[int] = []
            if char:
                t1 = time.perf_counter()
                affected = run_lazy_simulation(notify_rooms=False)
                sim_ms = (time.perf_counter() - t1) * 1000
                char = _get_character(request.user)
                if char is None:
                    char = _get_character_by_pk(character_pk)
            else:
                sim_ms = 0.0
            enc_lines: list[str] = []
            if char and encumbrance_excess(char) > 0:
                enc_lines.append("You are encumbered!")
            messages.extend(enc_lines)
            if char is None:
                logger.error(
                    "qff.command character missing after exec user_id=%s character_pk=%s line=%r",
                    getattr(request.user, "pk", None),
                    character_pk,
                    line[:500],
                )
                return Response(
                    {
                        "detail": "Character not found after command.",
                        "messages": messages,
                        "session": {"has_character": False},
                        "echo_command": echo_command,
                    },
                    status=status.HTTP_410_GONE,
                )
            t2 = time.perf_counter()
            session = build_session_for_character(char, world_sync=False)
            session_ms = (time.perf_counter() - t2) * 1000
            # Chronological narrative: room broadcasts during command, then command lines, then sim, then encumbrance.
            raw_log = session.get("action_log") or []
            if raw_log and char:
                exec_part = [
                    e for e in raw_log if _action_log_entry_id(e) <= max_after_exec
                ]
                sim_part = [e for e in raw_log if _action_log_entry_id(e) > max_after_exec]
                cmd_only = (
                    messages[: -len(enc_lines)] if enc_lines else list(messages)
                )
                synth_cmd = [{"id": -(i + 1), "text": m} for i, m in enumerate(cmd_only)]
                synth_enc = [{"id": -(200 + i), "text": m} for i, m in enumerate(enc_lines)]
                session["action_log"] = exec_part + synth_cmd + sim_part + synth_enc
            room_ids = frozenset(affected) | {old_room_id, char.current_room_id}

            def _queue_notify() -> None:
                schedule_notify_qff_rooms(room_ids)

            transaction.on_commit(_queue_notify)

        total_ms = (time.perf_counter() - wall_start) * 1000
        uid = getattr(request.user, "pk", None)
        session_pct = (100.0 * session_ms / total_ms) if total_ms > 0 else 0.0
        # Work outside exec/sim/session: _get_character (×2), ineffective-input insert, encumbrance, etc.
        gap_ms = max(0.0, total_ms - sync_ms - exec_ms - sim_ms - session_ms)
        parsed_kind = type(parsed).__name__
        logger.debug(
            "qff.command user_id=%s parsed=%s sync_ms=%.1f exec_ms=%.1f sim_ms=%.1f session_ms=%.1f gap_ms=%.1f total_ms=%.1f session_pct=%.1f",
            uid,
            parsed_kind,
            sync_ms,
            exec_ms,
            sim_ms,
            session_ms,
            gap_ms,
            total_ms,
            session_pct,
        )
        if getattr(settings, "QFF_COMMAND_TIMING_LOG", False):
            logger.info(
                "qff_command_timing user_id=%s parsed=%s sync_ms=%.2f exec_ms=%.2f sim_ms=%.2f session_ms=%.2f gap_ms=%.2f total_ms=%.2f session_pct=%.2f",
                uid,
                parsed_kind,
                sync_ms,
                exec_ms,
                sim_ms,
                session_ms,
                gap_ms,
                total_ms,
                session_pct,
            )

        return Response(
            {"messages": messages, "session": session, "echo_command": echo_command}
        )
    except Exception:
        logger.exception(
            "qff.command_view failed user_id=%s character_pk=%s line=%r",
            getattr(request.user, "pk", None),
            character_pk,
            line[:500],
        )
        return Response(
            {
                "detail": "A server error occurred while processing your command.",
                "messages": [],
                "session": None,
                "echo_command": False,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# --- DM (staff) ---


def _dm_area_cell_query(area_id):
    return AreaCell.objects.filter(area_id=area_id).select_related("room")


def _dm_area_dict(area: Area) -> dict:
    return {
        "id": area.id,
        "name": area.name,
        "slug": area.slug,
        "description": area.description,
        "grid_width": area.grid_width,
        "grid_height": area.grid_height,
        "is_dark_minimap": area.is_dark_minimap,
        "theme": resolved_area_theme(area),
        "theme_primary": area.theme_primary or "",
        "theme_secondary": area.theme_secondary or "",
        "theme_accent": area.theme_accent or "",
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_area_list_create(request):
    if request.method == "GET":
        rows = Area.objects.order_by("name")
        return Response([_dm_area_dict(a) for a in rows])
    name = (request.data.get("name") or "").strip()
    slug = (request.data.get("slug") or "").strip()
    if not name or not slug:
        return Response(
            {"detail": "name and slug are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    a = Area.objects.create(
        name=name,
        slug=slug,
        description=(request.data.get("description") or "").strip(),
        grid_width=int(request.data.get("grid_width") or 3),
        grid_height=int(request.data.get("grid_height") or 3),
        theme_primary=normalize_hex_color(request.data.get("theme_primary")),
        theme_secondary=normalize_hex_color(request.data.get("theme_secondary")),
        theme_accent=normalize_hex_color(request.data.get("theme_accent")),
    )
    return Response(_dm_area_dict(a), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_area_detail(request, pk):
    area = get_object_or_404(Area, pk=pk)
    if request.method == "GET":
        return Response(_dm_area_dict(area))
    if request.method == "DELETE":
        area.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    for field in ("name", "slug", "description"):
        if field in request.data:
            setattr(area, field, request.data.get(field) or "")
    if "grid_width" in request.data:
        area.grid_width = max(1, int(request.data["grid_width"]))
    if "grid_height" in request.data:
        area.grid_height = max(1, int(request.data["grid_height"]))
    for tf in ("theme_primary", "theme_secondary", "theme_accent"):
        if tf in request.data:
            setattr(area, tf, normalize_hex_color(request.data.get(tf)))
    if "is_dark_minimap" in request.data:
        area.is_dark_minimap = bool(request.data["is_dark_minimap"])
    area.save()
    return Response(_dm_area_dict(area))


def _dm_export_room_slug(room: Room) -> str:
    s = (room.slug or "").strip()
    if s:
        return s[:80]
    return f"room-{room.id}"


def _dm_place_room_at_cell(area: Area, room: Room, x: int, y: int):
    """Place or move a room on the area grid (swap if needed).

    Returns (AreaCell, modified) where modified is False if already at (x,y), else True
    (HTTP 200 vs 201 for the cell endpoint).
    """
    if not (0 <= x < area.grid_width and 0 <= y < area.grid_height):
        raise ValueError("Coordinates out of bounds.")
    with transaction.atomic():
        moving_cell = (
            AreaCell.objects.select_for_update()
            .filter(room=room, area=area)
            .first()
        )
        target_cell = (
            AreaCell.objects.select_for_update()
            .filter(area=area, x=x, y=y)
            .select_related("room")
            .first()
        )

        if moving_cell and moving_cell.x == x and moving_cell.y == y:
            return moving_cell, False
        if target_cell is None:
            if moving_cell:
                moving_cell.delete()
            return AreaCell.objects.create(area=area, x=x, y=y, room=room), True
        other_room = target_cell.room
        if moving_cell:
            old_x, old_y = moving_cell.x, moving_cell.y
            moving_cell.delete()
            target_cell.delete()
            AreaCell.objects.create(area=area, x=x, y=y, room=room)
            AreaCell.objects.create(area=area, x=old_x, y=old_y, room=other_room)
            return AreaCell.objects.get(room=room, area=area), True
        target_cell.delete()
        return AreaCell.objects.create(area=area, x=x, y=y, room=room), True


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_cell_list_create(request, area_id):
    area = get_object_or_404(Area, pk=area_id)
    if request.method == "GET":
        cells = _dm_area_cell_query(area.id)
        return Response(
            [
                {
                    "id": c.id,
                    "x": c.x,
                    "y": c.y,
                    "room_id": c.room_id,
                    "room_name": c.room.name,
                }
                for c in cells
            ]
        )
    room_id = request.data.get("room_id")
    x = int(request.data.get("x"))
    y = int(request.data.get("y"))
    if room_id is None:
        return Response(
            {"detail": "room_id required."}, status=status.HTTP_400_BAD_REQUEST
        )
    room = get_object_or_404(Room, pk=room_id, area_id=area.id)
    try:
        cell, modified = _dm_place_room_at_cell(area, room, x, y)
    except ValueError as e:
        return Response(
            {"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST
        )
    http_status = (
        status.HTTP_201_CREATED if modified else status.HTTP_200_OK
    )
    return Response(
        {"id": cell.id, "x": cell.x, "y": cell.y, "room_id": cell.room_id},
        status=http_status,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_cell_detail(request, pk):
    cell = get_object_or_404(AreaCell, pk=pk)
    if request.method == "DELETE":
        cell.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "room_id" in request.data:
        room = get_object_or_404(
            Room, pk=request.data["room_id"], area_id=cell.area_id
        )
        cell.room = room
        cell.save()
    return Response(
        {"id": cell.id, "x": cell.x, "y": cell.y, "room_id": cell.room_id}
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_area_exit_list(request, area_id):
    """All exits originating from rooms in this area (for DM map overlay)."""
    get_object_or_404(Area, pk=area_id)
    qs = (
        RoomExit.objects.filter(from_room__area_id=area_id)
        .select_related("from_room", "to_room")
        .order_by("from_room_id", "direction")
    )
    return Response(
        [
            {
                "id": e.id,
                "from_room_id": e.from_room_id,
                "direction": e.direction,
                "to_room_id": e.to_room_id,
                "to_room_name": e.to_room.name,
                "is_hidden": e.is_hidden,
                "lock_kind": e.lock_kind,
            }
            for e in qs
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_area_rooms_export_json(request, area_id):
    """Download all rooms and exits for an area as JSON (backup / bulk edit)."""
    area = get_object_or_404(Area, pk=area_id)
    rooms_out = []
    for room in Room.objects.filter(area=area).order_by("id"):
        cell = AreaCell.objects.filter(room=room).first()
        exits_out = []
        for ex in RoomExit.objects.filter(from_room=room).select_related(
            "to_room__area",
            "reveal_item",
            "reveal_quest_state__quest",
        ).order_by("direction"):
            to = ex.to_room
            reveal_item_slug = (
                ex.reveal_item.slug if ex.reveal_item_id else None
            )
            reveal_quest_slug = (
                ex.reveal_quest_state.quest.slug
                if ex.reveal_quest_state_id
                else None
            )
            reveal_quest_state_slug = (
                ex.reveal_quest_state.slug if ex.reveal_quest_state_id else None
            )
            if to.area_id == area.id:
                exits_out.append(
                    {
                        "direction": ex.direction,
                        "to_area_slug": None,
                        "to_room_slug": _dm_export_room_slug(to),
                        "is_hidden": ex.is_hidden,
                        "lock_kind": ex.lock_kind,
                        "reveal_item_slug": reveal_item_slug,
                        "reveal_quest_slug": reveal_quest_slug,
                        "reveal_quest_state_slug": reveal_quest_state_slug,
                    }
                )
            else:
                exits_out.append(
                    {
                        "direction": ex.direction,
                        "to_area_slug": to.area.slug,
                        "to_room_slug": _dm_export_room_slug(to),
                        "is_hidden": ex.is_hidden,
                        "lock_kind": ex.lock_kind,
                        "reveal_item_slug": reveal_item_slug,
                        "reveal_quest_slug": reveal_quest_slug,
                        "reveal_quest_state_slug": reveal_quest_state_slug,
                    }
                )
        rooms_out.append(
            {
                "id": room.id,
                "slug": _dm_export_room_slug(room),
                "name": room.name,
                "description": room.description,
                "search_text": room.search_text,
                "search_chance": room.search_chance,
                "cell": (
                    {"x": cell.x, "y": cell.y}
                    if cell
                    else None
                ),
                "exits": exits_out,
            }
        )
    payload = {
        "version": 1,
        "format": "qff-area-rooms",
        "area": {
            "id": area.id,
            "slug": area.slug,
            "name": area.name,
        },
        "rooms": rooms_out,
    }
    return Response(payload)


def _dm_import_resolve_target_room(
    area: Area, to_area_slug, to_room_slug: str
) -> Room | None:
    to_room_slug = (to_room_slug or "").strip()
    if not to_room_slug:
        return None
    tas = (to_area_slug or "").strip() if to_area_slug else ""
    if not tas:
        return Room.objects.filter(
            area=area,
            slug=to_room_slug[:80],
        ).first()
    other = Area.objects.filter(slug=tas[:80]).first()
    if not other:
        return None
    return Room.objects.filter(
        area=other,
        slug=to_room_slug[:80],
    ).first()


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_area_rooms_import_json(request, area_id):
    """Bulk upsert rooms and exits from JSON (see GET export shape)."""
    area = get_object_or_404(Area, pk=area_id)
    payload = request.data
    if not isinstance(payload, dict):
        return Response(
            {"detail": "JSON object required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if payload.get("version") != 1:
        return Response(
            {"detail": "Unsupported version. Expected 1."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    rooms_data = payload.get("rooms")
    if not isinstance(rooms_data, list):
        return Response(
            {"detail": "rooms must be an array."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pa = payload.get("area")
    if isinstance(pa, dict) and pa.get("id") is not None:
        try:
            if int(pa["id"]) != area.id:
                return Response(
                    {
                        "detail": "JSON area.id does not match this area — wrong file?",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except (TypeError, ValueError):
            pass

    valid_locks = {x[0] for x in RoomExit.LockKind.choices}

    def do_import():
        # Pass 1: upsert rooms and grid cells
        for rspec in rooms_data:
            if not isinstance(rspec, dict):
                raise ValueError("Each room must be an object.")
            rid = rspec.get("id")
            slug = (rspec.get("slug") or "").strip()[:80]
            if not slug:
                raise ValueError("Each room needs a non-empty slug.")
            name = (rspec.get("name") or "").strip() or "Room"
            if len(name) > 200:
                raise ValueError(f'Room name too long: {slug!r}')
            room = None
            if rid is not None:
                try:
                    room = Room.objects.filter(pk=int(rid), area=area).first()
                except (TypeError, ValueError):
                    room = None
            if room is None:
                room = Room.objects.filter(area=area, slug=slug).first()
            if room is None:
                sc = rspec.get("search_chance", 50)
                try:
                    sc = max(1, min(100, int(sc)))
                except (TypeError, ValueError):
                    sc = 50
                room = Room.objects.create(
                    area=area,
                    name=name,
                    slug=slug,
                    description=(rspec.get("description") or "")[:],
                    search_text=(rspec.get("search_text") or "")[:],
                    search_chance=sc,
                )
            else:
                room.name = name
                room.slug = slug
                room.description = rspec.get("description") or ""
                room.search_text = rspec.get("search_text") or ""
                if "search_chance" in rspec:
                    try:
                        room.search_chance = max(
                            1, min(100, int(rspec["search_chance"]))
                        )
                    except (TypeError, ValueError):
                        pass
                room.save()

            cell = rspec.get("cell")
            if cell is not None and isinstance(cell, dict):
                x = cell.get("x")
                y = cell.get("y")
                if x is None or y is None:
                    raise ValueError(f"Room {slug!r}: cell needs x and y.")
                _dm_place_room_at_cell(area, room, int(x), int(y))

        # Pass 2: replace exits
        for rspec in rooms_data:
            slug = (rspec.get("slug") or "").strip()[:80]
            if not slug:
                continue
            from_room = Room.objects.filter(area=area, slug=slug).first()
            if not from_room:
                continue
            RoomExit.objects.filter(from_room=from_room).delete()
            for es in rspec.get("exits") or []:
                if not isinstance(es, dict):
                    raise ValueError("Each exit must be an object.")
                direction = (es.get("direction") or "").strip()
                if not direction:
                    raise ValueError(f"Room {slug!r}: exit missing direction.")
                to_room = _dm_import_resolve_target_room(
                    area,
                    es.get("to_area_slug"),
                    es.get("to_room_slug") or "",
                )
                if not to_room:
                    raise ValueError(
                        f"Room {slug!r}: exit {direction!r} targets missing room "
                        f"(to_area_slug={es.get('to_area_slug')!r}, "
                        f"to_room_slug={es.get('to_room_slug')!r})."
                    )
                lk = es.get("lock_kind") or RoomExit.LockKind.NONE
                if lk not in valid_locks:
                    lk = RoomExit.LockKind.NONE
                err = _validate_exit_spatial(from_room, to_room, direction)
                if err:
                    raise ValueError(f"Room {slug!r}: {err}")
                reveal_item_id = None
                ris = (es.get("reveal_item_slug") or "").strip()
                if ris:
                    rit = Item.objects.filter(slug=ris[:80]).first()
                    if rit:
                        reveal_item_id = rit.id
                reveal_qs_id = None
                rqs_slug = (es.get("reveal_quest_state_slug") or "").strip()
                rq_slug = (es.get("reveal_quest_slug") or "").strip()
                if rqs_slug and rq_slug:
                    rq = Quest.objects.filter(slug=rq_slug[:80]).first()
                    if rq:
                        st = QuestState.objects.filter(
                            quest=rq, slug=rqs_slug[:80]
                        ).first()
                        if st:
                            reveal_qs_id = st.id
                RoomExit.objects.create(
                    from_room=from_room,
                    to_room=to_room,
                    direction=direction,
                    is_hidden=bool(es.get("is_hidden")),
                    lock_kind=lk,
                    reveal_item_id=reveal_item_id,
                    reveal_quest_state_id=reveal_qs_id,
                )

    try:
        with transaction.atomic():
            do_import()
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, KeyError) as e:
        return Response(
            {"detail": f"Invalid JSON structure: {e}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "ok": True,
            "area_id": area.id,
            "rooms_imported": len(rooms_data),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_room_list_create(request, area_id):
    area = get_object_or_404(Area, pk=area_id)
    if request.method == "GET":
        rooms = Room.objects.filter(area=area).order_by("name")
        out = []
        for r in rooms:
            c = AreaCell.objects.filter(room=r).first()
            out.append(
                {
                    "id": r.id,
                    "name": r.name,
                    "slug": r.slug,
                    "description": r.description,
                    "search_text": r.search_text,
                    "search_chance": r.search_chance,
                    "permanent_minimap_light": r.permanent_minimap_light,
                    "reset_dark_lighting_on_enter": r.reset_dark_lighting_on_enter,
                    "is_safe": r.is_safe,
                    "is_spawn_point": r.is_spawn_point,
                    "monster_lair_template_id": r.monster_lair_template_id,
                    "cell": (
                        {"id": c.id, "x": c.x, "y": c.y}
                        if c
                        else None
                    ),
                }
            )
        return Response(out)
    name = (request.data.get("name") or "").strip()
    if not name:
        return Response(
            {"detail": "name is required."}, status=status.HTTP_400_BAD_REQUEST
        )
    sc_raw = request.data.get("search_chance", 50)
    try:
        sc = max(1, min(100, int(sc_raw)))
    except (TypeError, ValueError):
        sc = 50
    room = Room.objects.create(
        area=area,
        name=name,
        slug=(request.data.get("slug") or "")[:80],
        description=(request.data.get("description") or ""),
        search_text=(request.data.get("search_text") or ""),
        search_chance=sc,
    )
    cx = request.data.get("cell_x")
    cy = request.data.get("cell_y")
    if cx is not None and cy is not None:
        x, y = int(cx), int(cy)
        if 0 <= x < area.grid_width and 0 <= y < area.grid_height:
            AreaCell.objects.update_or_create(
                area=area,
                x=x,
                y=y,
                defaults={"room": room},
            )
    return Response(
        {
            "id": room.id,
            "name": room.name,
            "slug": room.slug,
            "description": room.description,
            "search_text": room.search_text,
            "search_chance": room.search_chance,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_room_detail(request, pk):
    room = get_object_or_404(Room.objects.select_related("area"), pk=pk)
    if request.method == "GET":
        c = AreaCell.objects.filter(room=room).first()
        return Response(
            {
                "id": room.id,
                "area_id": room.area_id,
                "name": room.name,
                "slug": room.slug,
                "description": room.description,
                "search_text": room.search_text,
                "search_chance": room.search_chance,
                "permanent_minimap_light": room.permanent_minimap_light,
                "reset_dark_lighting_on_enter": room.reset_dark_lighting_on_enter,
                "is_safe": room.is_safe,
                "is_spawn_point": room.is_spawn_point,
                "monster_lair_template_id": room.monster_lair_template_id,
                "cell": (
                    {"id": c.id, "x": c.x, "y": c.y}
                    if c
                    else None
                ),
            }
        )
    if request.method == "DELETE":
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    for f in ("name", "slug", "description", "search_text"):
        if f in request.data:
            setattr(room, f, request.data.get(f) or "")
    if "search_chance" in request.data:
        try:
            room.search_chance = max(1, min(100, int(request.data["search_chance"])))
        except (TypeError, ValueError):
            pass
    if "permanent_minimap_light" in request.data:
        room.permanent_minimap_light = bool(request.data["permanent_minimap_light"])
    if "reset_dark_lighting_on_enter" in request.data:
        room.reset_dark_lighting_on_enter = bool(
            request.data["reset_dark_lighting_on_enter"]
        )
    if "is_safe" in request.data:
        room.is_safe = bool(request.data["is_safe"])
    if "is_spawn_point" in request.data:
        room.is_spawn_point = bool(request.data["is_spawn_point"])
    if "monster_lair_template_id" in request.data:
        v = request.data["monster_lair_template_id"]
        if v in (None, "", 0, "0"):
            room.monster_lair_template_id = None
        else:
            get_object_or_404(MonsterTemplate, pk=int(v))
            room.monster_lair_template_id = int(v)
    room.save()
    return Response(
        {
            "id": room.id,
            "name": room.name,
            "slug": room.slug,
            "description": room.description,
            "search_text": room.search_text,
            "search_chance": room.search_chance,
            "permanent_minimap_light": room.permanent_minimap_light,
            "reset_dark_lighting_on_enter": room.reset_dark_lighting_on_enter,
            "is_safe": room.is_safe,
            "is_spawn_point": room.is_spawn_point,
            "monster_lair_template_id": room.monster_lair_template_id,
        }
    )


def _dm_monster_template_dict(t: MonsterTemplate) -> dict:
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "spawn_cooldown_minutes": t.spawn_cooldown_minutes,
        "level": t.level,
        "max_hp": t.max_hp,
        "damage_min": t.damage_min,
        "damage_max": t.damage_max,
        "moves": t.moves,
        "xp_value": t.xp_value,
        "gold_min": t.gold_min,
        "gold_max": t.gold_max,
        "loot_table": t.loot_table or [],
        "armor": t.armor,
        "accuracy": t.accuracy,
        "penetration": t.penetration,
        "crit_chance_bonus_pct": t.crit_chance_bonus_pct,
        "crit_damage_bonus": t.crit_damage_bonus,
        "dodge_reduction": t.dodge_reduction,
        "dodge_ignore": t.dodge_ignore,
        "description": t.description or "",
        "hidden_description": t.hidden_description or "",
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_monster_template_list(request):
    if request.method == "GET":
        return Response(
            [_dm_monster_template_dict(t) for t in MonsterTemplate.objects.order_by("name")]
        )
    slug = (request.data.get("slug") or "").strip()
    name = (request.data.get("name") or "").strip()
    if not slug or not name:
        return Response(
            {"detail": "slug and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if MonsterTemplate.objects.filter(slug=slug).exists():
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    tpl = MonsterTemplate.objects.create(slug=slug[:80], name=name[:200])
    return Response(_dm_monster_template_dict(tpl), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_monster_template_detail(request, pk):
    tpl = get_object_or_404(MonsterTemplate, pk=pk)
    if request.method == "GET":
        return Response(_dm_monster_template_dict(tpl))
    if "slug" in request.data:
        tpl.slug = (request.data.get("slug") or "").strip()[:80]
    if "name" in request.data:
        tpl.name = (request.data.get("name") or "").strip()[:200]
    for f in (
        "spawn_cooldown_minutes",
        "level",
        "max_hp",
        "damage_min",
        "damage_max",
        "moves",
        "xp_value",
        "gold_min",
        "gold_max",
        "armor",
    ):
        if f in request.data:
            try:
                setattr(tpl, f, max(0, int(request.data.get(f) or 0)))
            except (TypeError, ValueError):
                pass
    if "accuracy" in request.data:
        try:
            tpl.accuracy = int(request.data.get("accuracy") or 0)
        except (TypeError, ValueError):
            pass
    if "penetration" in request.data:
        try:
            tpl.penetration = max(0, int(request.data.get("penetration") or 0))
        except (TypeError, ValueError):
            pass
    if "crit_chance_bonus_pct" in request.data:
        try:
            tpl.crit_chance_bonus_pct = int(request.data.get("crit_chance_bonus_pct") or 0)
        except (TypeError, ValueError):
            pass
    if "crit_damage_bonus" in request.data:
        try:
            tpl.crit_damage_bonus = float(request.data.get("crit_damage_bonus") or 0)
        except (TypeError, ValueError):
            pass
    if "dodge_reduction" in request.data:
        try:
            tpl.dodge_reduction = int(request.data.get("dodge_reduction") or 0)
        except (TypeError, ValueError):
            pass
    if "dodge_ignore" in request.data:
        try:
            tpl.dodge_ignore = int(request.data.get("dodge_ignore") or 0)
        except (TypeError, ValueError):
            pass
    if "loot_table" in request.data:
        raw = request.data.get("loot_table")
        if isinstance(raw, list):
            tpl.loot_table = raw
    if "description" in request.data:
        tpl.description = (request.data.get("description") or "")[:20000]
    if "hidden_description" in request.data:
        tpl.hidden_description = (request.data.get("hidden_description") or "")[:20000]
    tpl.save()
    return Response(_dm_monster_template_dict(tpl))


def _dm_floor_item_dict(inst: ItemInstance) -> dict:
    return {
        "id": inst.id,
        "item_id": inst.item_id,
        "item_slug": inst.item.slug,
        "item_name": inst.item.name,
        "quantity": max(1, int(inst.quantity or 1)),
        "nickname": inst.nickname or "",
        "visible_quest_state_id": inst.visible_quest_state_id,
        "visible_quest_id": (
            inst.visible_quest_state.quest_id if inst.visible_quest_state_id else None
        ),
        "visible_quest_slug": (
            inst.visible_quest_state.quest.slug if inst.visible_quest_state_id else None
        ),
        "visible_quest_state_slug": (
            inst.visible_quest_state.slug if inst.visible_quest_state_id else None
        ),
        "container_interactable_id": inst.container_interactable_id,
    }


def _dm_room_item_dict(ri: RoomItem) -> dict:
    return {
        "id": ri.id,
        "room_id": ri.room_id,
        "item_id": ri.item_id,
        "item_slug": ri.item.slug,
        "item_name": ri.item.name,
        "nickname": ri.nickname or "",
        "visible_quest_state_id": ri.visible_quest_state_id,
        "visible_quest_id": (
            ri.visible_quest_state.quest_id if ri.visible_quest_state_id else None
        ),
        "visible_quest_slug": (
            ri.visible_quest_state.quest.slug if ri.visible_quest_state_id else None
        ),
        "visible_quest_state_slug": (
            ri.visible_quest_state.slug if ri.visible_quest_state_id else None
        ),
        "allow_repeat_while_carrying": ri.allow_repeat_while_carrying,
        "interactable_id": ri.interactable_id,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_room_room_items(request, room_id):
    """List or create room item slots (mint-on-get; not shared floor instances)."""
    room = get_object_or_404(Room, pk=room_id)
    if request.method == "GET":
        qs = (
            RoomItem.objects.filter(room_id=room.id)
            .select_related("item", "visible_quest_state__quest")
            .order_by("id")
        )
        return Response([_dm_room_item_dict(i) for i in qs])
    item_id = request.data.get("item_id")
    try:
        item_id = int(item_id)
    except (TypeError, ValueError):
        return Response(
            {"detail": "item_id is required (item template id)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    get_object_or_404(Item, pk=item_id)
    nick = (request.data.get("nickname") or "").strip()
    vqs_id = request.data.get("visible_quest_state_id")
    visible_quest_state_id = None
    if vqs_id not in (None, ""):
        try:
            visible_quest_state_id = int(vqs_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "visible_quest_state_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        get_object_or_404(QuestState, pk=visible_quest_state_id)
    interactable_id = request.data.get("interactable_id")
    if interactable_id not in (None, ""):
        try:
            interactable_id = int(interactable_id)
        except (TypeError, ValueError):
            interactable_id = None
        if interactable_id is not None:
            o = get_object_or_404(Interactable, pk=interactable_id)
            if o.room_id != room.id:
                return Response(
                    {"detail": "interactable must belong to this room."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
    else:
        interactable_id = None
    ri = RoomItem.objects.create(
        room=room,
        item_id=item_id,
        nickname=nick or None,
        visible_quest_state_id=visible_quest_state_id,
        allow_repeat_while_carrying=bool(request.data.get("allow_repeat_while_carrying")),
        interactable_id=interactable_id,
    )
    ri = RoomItem.objects.select_related("item", "visible_quest_state__quest").get(pk=ri.pk)
    return Response(_dm_room_item_dict(ri), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_room_item_detail(request, pk):
    """Update nickname / visibility or remove a room item slot."""
    ri = get_object_or_404(
        RoomItem.objects.select_related("visible_quest_state__quest", "item"),
        pk=pk,
    )
    if request.method == "DELETE":
        ri.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "nickname" in request.data:
        n = (request.data.get("nickname") or "").strip()
        ri.nickname = n or None
    if "visible_quest_state_id" in request.data:
        v = request.data.get("visible_quest_state_id")
        if v in (None, ""):
            ri.visible_quest_state_id = None
        else:
            try:
                vsid = int(v)
            except (TypeError, ValueError):
                vsid = None
            if vsid is not None:
                get_object_or_404(QuestState, pk=vsid)
                ri.visible_quest_state_id = vsid
            else:
                ri.visible_quest_state_id = None
    if "allow_repeat_while_carrying" in request.data:
        ri.allow_repeat_while_carrying = bool(request.data.get("allow_repeat_while_carrying"))
    if "interactable_id" in request.data:
        v = request.data.get("interactable_id")
        if v in (None, ""):
            ri.interactable_id = None
        else:
            try:
                oid = int(v)
            except (TypeError, ValueError):
                oid = None
            if oid is not None:
                o = get_object_or_404(Interactable, pk=oid)
                if o.room_id != ri.room_id:
                    return Response(
                        {"detail": "interactable must belong to this room."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                ri.interactable_id = oid
            else:
                ri.interactable_id = None
    ri.save()
    ri = RoomItem.objects.select_related("item", "visible_quest_state__quest").get(pk=ri.pk)
    return Response(_dm_room_item_dict(ri))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_room_floor_items(request, room_id):
    """List or spawn unowned ItemInstance rows on the floor of a room (DM content)."""
    room = get_object_or_404(Room, pk=room_id)
    if request.method == "GET":
        qs = (
            ItemInstance.objects.filter(room_id=room.id, owner_character__isnull=True)
            .select_related("item", "visible_quest_state__quest")
            .order_by("id")
        )
        return Response([_dm_floor_item_dict(i) for i in qs])
    item_id = request.data.get("item_id")
    try:
        item_id = int(item_id)
    except (TypeError, ValueError):
        return Response(
            {"detail": "item_id is required (item template id)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    get_object_or_404(Item, pk=item_id)
    nick = (request.data.get("nickname") or "").strip()
    vqs_id = request.data.get("visible_quest_state_id")
    visible_quest_state_id = None
    if vqs_id not in (None, ""):
        try:
            visible_quest_state_id = int(vqs_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "visible_quest_state_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        get_object_or_404(QuestState, pk=visible_quest_state_id)
    container_interactable_id = request.data.get("container_interactable_id")
    if container_interactable_id not in (None, ""):
        try:
            container_interactable_id = int(container_interactable_id)
        except (TypeError, ValueError):
            container_interactable_id = None
        if container_interactable_id is not None:
            o = get_object_or_404(Interactable, pk=container_interactable_id)
            if o.room_id != room.id:
                return Response(
                    {"detail": "container_interactable must belong to this room."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
    else:
        container_interactable_id = None
    qty = max(1, int(request.data.get("quantity") or 1))
    inst = ItemInstance.objects.create(
        item_id=item_id,
        room=room,
        owner_character=None,
        neglect_count=0,
        floor_dropped_at=timezone.now(),
        nickname=nick or None,
        visible_quest_state_id=visible_quest_state_id,
        quantity=qty,
        container_interactable_id=container_interactable_id,
    )
    inst = ItemInstance.objects.select_related(
        "item", "visible_quest_state__quest"
    ).get(pk=inst.pk)
    return Response(_dm_floor_item_dict(inst), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_floor_item_detail(request, pk):
    """Update visibility rules or remove an unowned floor item instance."""
    inst = get_object_or_404(
        ItemInstance.objects.select_related("visible_quest_state__quest", "item"),
        pk=pk,
    )
    if inst.owner_character_id is not None:
        return Response(
            {"detail": "Only unowned floor items can be changed here."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if request.method == "DELETE":
        inst.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "visible_quest_state_id" in request.data:
        v = request.data.get("visible_quest_state_id")
        if v in (None, ""):
            inst.visible_quest_state_id = None
        else:
            try:
                vsid = int(v)
            except (TypeError, ValueError):
                vsid = None
            if vsid is not None:
                get_object_or_404(QuestState, pk=vsid)
                inst.visible_quest_state_id = vsid
            else:
                inst.visible_quest_state_id = None
    if "quantity" in request.data:
        try:
            q = int(request.data.get("quantity") or 1)
            inst.quantity = max(1, q)
        except (TypeError, ValueError):
            pass
    if "container_interactable_id" in request.data:
        v = request.data.get("container_interactable_id")
        if v in (None, ""):
            inst.container_interactable_id = None
        else:
            try:
                oid = int(v)
            except (TypeError, ValueError):
                oid = None
            if oid is not None:
                o = get_object_or_404(Interactable, pk=oid)
                if o.room_id != inst.room_id:
                    return Response(
                        {"detail": "container_interactable must belong to this room."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                inst.container_interactable_id = oid
            else:
                inst.container_interactable_id = None
    inst.save()
    inst = ItemInstance.objects.select_related(
        "item", "visible_quest_state__quest"
    ).get(pk=inst.pk)
    return Response(_dm_floor_item_dict(inst))


def _validate_exit_spatial(from_room: Room, to_room: Room, direction: str) -> str | None:
    """Return error message or None if ok."""
    if from_room.id == to_room.id:
        return "Exit cannot target the same room."
    semantic = {"up", "down", "in", "out"}
    if direction in semantic:
        return None
    if from_room.area_id != to_room.area_id:
        # Cross-area link: no grid alignment (each area has its own coordinates).
        return None
    try:
        fc = AreaCell.objects.get(room=from_room)
        tc = AreaCell.objects.get(room=to_room)
    except AreaCell.DoesNotExist:
        return "Both rooms must be placed on the grid for cardinal exits."
    dx = tc.x - fc.x
    dy = tc.y - fc.y
    expected = {
        RoomExit.Direction.N: (0, -1),
        RoomExit.Direction.S: (0, 1),
        RoomExit.Direction.E: (1, 0),
        RoomExit.Direction.W: (-1, 0),
        RoomExit.Direction.NW: (-1, -1),
        RoomExit.Direction.NE: (1, -1),
        RoomExit.Direction.SW: (-1, 1),
        RoomExit.Direction.SE: (1, 1),
    }
    for d, (ex, ey) in expected.items():
        if d.value == direction and (dx, dy) != (ex, ey):
            return (
                f"For {direction}, destination cell should be offset "
                f"({ex},{ey}) from origin; got ({dx},{dy})."
            )
    return None


def _dm_exit_dict(ex: RoomExit) -> dict:
    return {
        "id": ex.id,
        "from_room_id": ex.from_room_id,
        "direction": ex.direction,
        "to_room_id": ex.to_room_id,
        "is_hidden": ex.is_hidden,
        "lock_kind": ex.lock_kind,
        "key_item_id": ex.key_item_id,
        "key_item_slug": (
            ex.key_item.slug
            if ex.key_item_id and getattr(ex, "key_item", None)
            else None
        ),
        "key_unlock_scope": ex.key_unlock_scope,
        "device_interactable_id": ex.device_interactable_id,
        "quest_required_state_id": ex.quest_required_state_id,
        "quest_required_quest_slug": (
            ex.quest_required_state.quest.slug
            if ex.quest_required_state_id
            else None
        ),
        "quest_required_state_slug": (
            ex.quest_required_state.slug if ex.quest_required_state_id else None
        ),
        "unlock_duration_seconds": ex.unlock_duration_seconds,
        "reveal_item_id": ex.reveal_item_id,
        "reveal_item_slug": (
            ex.reveal_item.slug
            if ex.reveal_item_id and getattr(ex, "reveal_item", None)
            else None
        ),
        "reveal_quest_state_id": ex.reveal_quest_state_id,
        "reveal_quest_id": (
            ex.reveal_quest_state.quest_id if ex.reveal_quest_state_id else None
        ),
        "reveal_quest_slug": (
            ex.reveal_quest_state.quest.slug
            if ex.reveal_quest_state_id
            else None
        ),
        "reveal_quest_state_slug": (
            ex.reveal_quest_state.slug if ex.reveal_quest_state_id else None
        ),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_exit_list_create(request, room_id):
    room = get_object_or_404(Room, pk=room_id)
    if request.method == "GET":
        exits = RoomExit.objects.filter(from_room=room).select_related(
            "to_room",
            "key_item",
            "quest_required_state__quest",
            "reveal_item",
            "reveal_quest_state__quest",
        )
        return Response([_dm_exit_dict(e) | {"to_room_name": e.to_room.name} for e in exits])
    direction = (request.data.get("direction") or "").strip()
    to_id = request.data.get("to_room_id")
    if not direction or not to_id:
        return Response(
            {"detail": "direction and to_room_id required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    to_room = get_object_or_404(Room, pk=to_id)
    err = _validate_exit_spatial(room, to_room, direction)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    ex = RoomExit.objects.create(
        from_room=room,
        to_room=to_room,
        direction=direction,
        is_hidden=bool(request.data.get("is_hidden")),
        lock_kind=request.data.get("lock_kind") or RoomExit.LockKind.NONE,
    )
    return Response(
        _dm_exit_dict(ex) | {"to_room_name": ex.to_room.name},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_exit_detail(request, pk):
    ex = get_object_or_404(
        RoomExit.objects.select_related(
            "from_room",
            "to_room",
            "key_item",
            "quest_required_state__quest",
            "reveal_item",
            "reveal_quest_state__quest",
        ),
        pk=pk,
    )
    if request.method == "GET":
        return Response(_dm_exit_dict(ex))
    if request.method == "DELETE":
        ex.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "to_room_id" in request.data:
        to_room = get_object_or_404(Room, pk=request.data["to_room_id"])
        ex.to_room = to_room
    if "is_hidden" in request.data:
        ex.is_hidden = bool(request.data["is_hidden"])
    if "lock_kind" in request.data:
        ex.lock_kind = request.data["lock_kind"]
    if "direction" in request.data:
        ex.direction = request.data["direction"]
    if "key_item_id" in request.data:
        ex.key_item_id = _parse_optional_item_pk(request.data.get("key_item_id"))
    if "key_unlock_scope" in request.data:
        ex.key_unlock_scope = request.data["key_unlock_scope"] or ex.key_unlock_scope
    if "device_interactable_id" in request.data:
        v = request.data.get("device_interactable_id")
        ex.device_interactable_id = int(v) if v not in (None, "") else None
    if "quest_required_state_id" in request.data:
        v = request.data.get("quest_required_state_id")
        ex.quest_required_state_id = int(v) if v not in (None, "") else None
    if "reveal_item_id" in request.data:
        ex.reveal_item_id = _parse_optional_item_pk(request.data.get("reveal_item_id"))
    if "reveal_quest_state_id" in request.data:
        v = request.data.get("reveal_quest_state_id")
        ex.reveal_quest_state_id = int(v) if v not in (None, "") else None
    if "unlock_duration_seconds" in request.data:
        try:
            ex.unlock_duration_seconds = max(1, int(request.data.get("unlock_duration_seconds") or 600))
        except (TypeError, ValueError):
            pass
    err = _validate_exit_spatial(ex.from_room, ex.to_room, ex.direction)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    ex.save()
    ex = RoomExit.objects.select_related(
        "key_item",
        "quest_required_state__quest",
        "reveal_item",
        "reveal_quest_state__quest",
    ).get(pk=ex.pk)
    return Response(_dm_exit_dict(ex))


def _parse_item_slot_optional(raw) -> str | None:
    """Empty / missing → None (not equippable). Otherwise must be a valid Item.Slot value."""
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    s = str(raw).strip()[:16]
    valid = {c[0] for c in Item.Slot.choices}
    if s not in valid:
        return "__invalid__"
    return s


def _parse_extra_data_payload(raw):
    """Return dict, None if missing/omit, or sentinel invalid."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        try:
            o = json.loads(s)
            return o if isinstance(o, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _dm_item_dict(item: Item) -> dict:
    return {
        "id": item.id,
        "slug": item.slug,
        "name": item.name,
        "item_type": item.item_type,
        "slot": item.slot,
        "consumable": item.consumable,
        "consume_verb": item.consume_verb or "",
        "stackable": item.stackable,
        "max_stack": item.max_stack,
        "extra_data": item.extra_data or {},
        "cost": item.cost,
        "description": item.description,
        "lore": item.lore,
        "lore_chance": item.lore_chance,
        "rarity": item.rarity,
        "damage": item.damage,
        "dmg_type": item.dmg_type,
        "armor": item.armor,
        "element": item.element,
        "hidden_special_effect": item.hidden_special_effect,
        "hidden_bonus_stat": item.hidden_bonus_stat,
        "hidden_bonus_value": item.hidden_bonus_value,
        "two_handed": item.two_handed,
        "req_gains": item.req_gains,
        "req_moves": item.req_moves,
        "req_guts": item.req_guts,
        "req_smarts": item.req_smarts,
        "req_sense": item.req_sense,
        "req_rizz": item.req_rizz,
        "bonus_gains": item.bonus_gains,
        "bonus_moves": item.bonus_moves,
        "bonus_guts": item.bonus_guts,
        "bonus_smarts": item.bonus_smarts,
        "bonus_sense": item.bonus_sense,
        "bonus_rizz": item.bonus_rizz,
        "weapon_accuracy": item.weapon_accuracy,
        "crit_chance_bonus_pct": item.crit_chance_bonus_pct,
        "crit_damage_bonus": item.crit_damage_bonus,
        "penetration": item.penetration,
        "dodge_bonus": item.dodge_bonus,
        "dodge_reduction": item.dodge_reduction,
        "dodge_ignore": item.dodge_ignore,
        "unsellable": item.unsellable,
        "vendor_refuses_buy": item.vendor_refuses_buy,
    }


def _parse_optional_positive_int(val):
    if val is None or val == "":
        return None
    try:
        v = int(val)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _coerce_consume_verb(val):
    """Return consume_verb string, or None if invalid."""
    if val is None or (isinstance(val, str) and not val.strip()):
        return ""
    v = str(val).strip().lower()
    if v not in ("eat", "drink", "use"):
        return None
    return v


def _coerce_hidden_bonus_stat(val):
    """Return Item.HiddenBonusStat value, or None if invalid."""
    if val is None or (isinstance(val, str) and not val.strip()):
        return Item.HiddenBonusStat.NONE
    v = str(val).strip()
    valid = {c[0] for c in Item.HiddenBonusStat.choices}
    if v not in valid:
        return None
    return v


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_item_list_create(request):
    if request.method == "GET":
        rows = Item.objects.order_by("name")
        return Response([_dm_item_dict(i) for i in rows])
    slug = (request.data.get("slug") or "").strip()
    name = (request.data.get("name") or "").strip()
    if not slug or not name:
        return Response(
            {"detail": "slug and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    slot = _parse_item_slot_optional(request.data.get("slot"))
    if slot == "__invalid__":
        return Response(
            {"detail": "invalid slot."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if Item.objects.filter(slug=slug).exists():
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    hbs = _coerce_hidden_bonus_stat(request.data.get("hidden_bonus_stat"))
    if hbs is None:
        return Response(
            {"detail": "invalid hidden_bonus_stat."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    cv = _coerce_consume_verb(request.data.get("consume_verb"))
    if cv is None:
        return Response(
            {"detail": "invalid consume_verb."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ed = _parse_extra_data_payload(request.data.get("extra_data"))
    if request.data.get("extra_data") is not None and ed is None:
        return Response(
            {"detail": "extra_data must be a JSON object."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    item = Item.objects.create(
        slug=slug[:80],
        name=name[:200],
        item_type=(request.data.get("item_type") or "")[:64],
        slot=slot,
        consumable=bool(request.data.get("consumable")),
        consume_verb=cv,
        stackable=bool(request.data.get("stackable")),
        max_stack=max(1, min(9999, int(request.data.get("max_stack") or 99))),
        extra_data=ed or {},
        cost=int(request.data.get("cost") or 0),
        description=(request.data.get("description") or "")[:],
        lore=(request.data.get("lore") or "")[:],
        lore_chance=_parse_optional_positive_int(request.data.get("lore_chance")),
        rarity=str(request.data.get("rarity") or Item.Rarity.COMMON)[:16],
        damage=int(request.data.get("damage") or 0),
        dmg_type=str(request.data.get("dmg_type") or Item.DmgType.PHYSICAL)[:16],
        armor=max(0, int(request.data.get("armor") or 0)),
        element=(request.data.get("element") or "")[:32],
        hidden_special_effect=(
            request.data.get("hidden_special_effect") or Item.HiddenSpecialEffect.NONE
        )[:32],
        hidden_bonus_stat=hbs,
        hidden_bonus_value=int(request.data.get("hidden_bonus_value") or 0),
        two_handed=bool(request.data.get("two_handed")),
        req_gains=_parse_optional_positive_int(request.data.get("req_gains")),
        req_moves=_parse_optional_positive_int(request.data.get("req_moves")),
        req_guts=_parse_optional_positive_int(request.data.get("req_guts")),
        req_smarts=_parse_optional_positive_int(request.data.get("req_smarts")),
        req_sense=_parse_optional_positive_int(request.data.get("req_sense")),
        req_rizz=_parse_optional_positive_int(request.data.get("req_rizz")),
        bonus_gains=int(request.data.get("bonus_gains") or 0),
        bonus_moves=int(request.data.get("bonus_moves") or 0),
        bonus_guts=int(request.data.get("bonus_guts") or 0),
        bonus_smarts=int(request.data.get("bonus_smarts") or 0),
        bonus_sense=int(request.data.get("bonus_sense") or 0),
        bonus_rizz=int(request.data.get("bonus_rizz") or 0),
        weapon_accuracy=int(request.data.get("weapon_accuracy") or 0),
        crit_chance_bonus_pct=int(request.data.get("crit_chance_bonus_pct") or 0),
        crit_damage_bonus=float(request.data.get("crit_damage_bonus") or 0),
        penetration=max(0, int(request.data.get("penetration") or 0)),
        dodge_bonus=int(request.data.get("dodge_bonus") or 0),
        dodge_reduction=int(request.data.get("dodge_reduction") or 0),
        dodge_ignore=int(request.data.get("dodge_ignore") or 0),
        unsellable=bool(request.data.get("unsellable")),
        vendor_refuses_buy=bool(request.data.get("vendor_refuses_buy")),
    )
    return Response(_dm_item_dict(item), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_item_detail(request, pk):
    item = get_object_or_404(Item, pk=pk)
    if request.method == "GET":
        return Response(_dm_item_dict(item))
    if request.method == "DELETE":
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        item.slug = (request.data.get("slug") or "")[:80]
    if "name" in request.data:
        item.name = (request.data.get("name") or "")[:200]
    if "item_type" in request.data:
        item.item_type = (request.data.get("item_type") or "")[:64]
    if "slot" in request.data:
        slot = _parse_item_slot_optional(request.data.get("slot"))
        if slot == "__invalid__":
            return Response(
                {"detail": "invalid slot."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.slot = slot
    if "consumable" in request.data:
        item.consumable = bool(request.data.get("consumable"))
    if "consume_verb" in request.data:
        cv = _coerce_consume_verb(request.data.get("consume_verb"))
        if cv is None:
            return Response(
                {"detail": "invalid consume_verb."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.consume_verb = cv
    if "stackable" in request.data:
        item.stackable = bool(request.data.get("stackable"))
    if "max_stack" in request.data:
        try:
            item.max_stack = max(1, min(9999, int(request.data.get("max_stack") or 99)))
        except (TypeError, ValueError):
            pass
    if "extra_data" in request.data:
        ed = _parse_extra_data_payload(request.data.get("extra_data"))
        if ed is None:
            return Response(
                {"detail": "extra_data must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.extra_data = ed
    if "description" in request.data:
        item.description = request.data.get("description") or ""
    if "lore" in request.data:
        item.lore = request.data.get("lore") or ""
    if "lore_chance" in request.data:
        item.lore_chance = _parse_optional_positive_int(request.data.get("lore_chance"))
    if "rarity" in request.data:
        item.rarity = (request.data.get("rarity") or item.rarity)[:16]
    if "damage" in request.data:
        item.damage = max(0, int(request.data.get("damage") or 0))
    if "dmg_type" in request.data:
        item.dmg_type = (request.data.get("dmg_type") or item.dmg_type)[:16]
    if "armor" in request.data:
        item.armor = max(0, int(request.data.get("armor") or 0))
    if "element" in request.data:
        item.element = (request.data.get("element") or "")[:32]
    if "hidden_special_effect" in request.data:
        item.hidden_special_effect = (
            request.data.get("hidden_special_effect") or Item.HiddenSpecialEffect.NONE
        )[:32]
    if "hidden_bonus_stat" in request.data:
        hbs = _coerce_hidden_bonus_stat(request.data.get("hidden_bonus_stat"))
        if hbs is None:
            return Response(
                {"detail": "invalid hidden_bonus_stat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.hidden_bonus_stat = hbs
    if "hidden_bonus_value" in request.data:
        item.hidden_bonus_value = int(request.data.get("hidden_bonus_value") or 0)
    if "two_handed" in request.data:
        item.two_handed = bool(request.data["two_handed"])
    if "cost" in request.data:
        item.cost = max(0, int(request.data.get("cost") or 0))
    for rf in (
        "req_gains",
        "req_moves",
        "req_guts",
        "req_smarts",
        "req_sense",
        "req_rizz",
    ):
        if rf in request.data:
            setattr(item, rf, _parse_optional_positive_int(request.data.get(rf)))
    for bf in (
        "bonus_gains",
        "bonus_moves",
        "bonus_guts",
        "bonus_smarts",
        "bonus_sense",
        "bonus_rizz",
        "weapon_accuracy",
        "crit_chance_bonus_pct",
        "dodge_bonus",
        "dodge_reduction",
        "dodge_ignore",
    ):
        if bf in request.data:
            setattr(item, bf, int(request.data.get(bf) or 0))
    if "crit_damage_bonus" in request.data:
        try:
            item.crit_damage_bonus = float(request.data.get("crit_damage_bonus") or 0)
        except (TypeError, ValueError):
            pass
    if "penetration" in request.data:
        try:
            item.penetration = max(0, int(request.data.get("penetration") or 0))
        except (TypeError, ValueError):
            pass
    if "unsellable" in request.data:
        item.unsellable = bool(request.data["unsellable"])
    if "vendor_refuses_buy" in request.data:
        item.vendor_refuses_buy = bool(request.data["vendor_refuses_buy"])
    item.save()
    return Response(_dm_item_dict(item))


def _dm_class_dict(cc: CharacterClass) -> dict:
    return {
        "id": cc.id,
        "slug": cc.slug,
        "name": cc.name,
        "sort_order": cc.sort_order,
        "description": cc.description,
        "priority_stat_1": cc.priority_stat_1,
        "priority_stat_2": cc.priority_stat_2,
        "starter_chest_item_id": cc.starter_chest_item_id,
        "starter_main_hand_item_id": cc.starter_main_hand_item_id,
        "extra_data": cc.extra_data or {},
    }


def _coerce_priority_stat(val):
    if val is None or val == "":
        return None
    v = str(val).strip()
    valid = {c[0] for c in CharacterClass.PriorityStat.choices}
    if v not in valid:
        return None
    return v


def _parse_optional_item_pk(val):
    if val is None or val == "":
        return None
    try:
        v = int(val)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _validate_class_starter_slots(body) -> str | None:
    checks = (
        ("starter_chest_item_id", Item.Slot.CHEST),
        ("starter_main_hand_item_id", Item.Slot.MAIN_HAND),
    )
    for key, slot in checks:
        if key not in body:
            continue
        pk = _parse_optional_item_pk(body.get(key))
        if pk is None:
            continue
        it = Item.objects.filter(pk=pk).first()
        if not it:
            return f"Unknown item id for {key}."
        if not it.slot or it.slot != slot.value:
            got = it.get_slot_display() if it.slot else "not equippable"
            return f"{key} must be a {slot.label} item (got {got})."
    return None


def _parse_extra_data(raw) -> dict | None:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if raw == "":
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_class_list_create(request):
    if request.method == "GET":
        rows = CharacterClass.objects.order_by("sort_order", "name").select_related(
            "starter_chest_item",
            "starter_main_hand_item",
        )
        return Response([_dm_class_dict(c) for c in rows])
    slug = (request.data.get("slug") or "").strip()
    name = (request.data.get("name") or "").strip()
    if not slug or not name:
        return Response(
            {"detail": "slug and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if CharacterClass.objects.filter(slug=slug).exists():
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ps1 = _coerce_priority_stat(request.data.get("priority_stat_1"))
    ps2 = _coerce_priority_stat(request.data.get("priority_stat_2"))
    if ps1 is None:
        ps1 = CharacterClass.PriorityStat.GAINS
    if ps2 is None:
        ps2 = CharacterClass.PriorityStat.GUTS
    if ps1 == ps2:
        return Response(
            {"detail": "priority_stat_1 and priority_stat_2 must differ."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    err = _validate_class_starter_slots(request.data)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    extra = _parse_extra_data(request.data.get("extra_data"))
    if extra is None:
        return Response(
            {"detail": "extra_data must be a JSON object."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    cc = CharacterClass.objects.create(
        slug=slug[:32],
        name=name[:100],
        sort_order=max(0, int(request.data.get("sort_order") or 0)),
        description=(request.data.get("description") or "")[:],
        priority_stat_1=ps1,
        priority_stat_2=ps2,
        starter_chest_item_id=_parse_optional_item_pk(
            request.data.get("starter_chest_item_id")
        ),
        starter_main_hand_item_id=_parse_optional_item_pk(
            request.data.get("starter_main_hand_item_id")
        ),
        extra_data=extra,
    )
    return Response(_dm_class_dict(cc), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_class_detail(request, pk):
    cc = get_object_or_404(CharacterClass, pk=pk)
    if request.method == "GET":
        return Response(_dm_class_dict(cc))
    if request.method == "DELETE":
        try:
            cc.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "Cannot delete a class that has characters; reassign or delete them first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        cc.slug = (request.data.get("slug") or "")[:32]
    if "name" in request.data:
        cc.name = (request.data.get("name") or "")[:100]
    if "sort_order" in request.data:
        cc.sort_order = max(0, int(request.data.get("sort_order") or 0))
    if "description" in request.data:
        cc.description = request.data.get("description") or ""
    if "priority_stat_1" in request.data:
        p = _coerce_priority_stat(request.data.get("priority_stat_1"))
        if p is None:
            return Response(
                {"detail": "invalid priority_stat_1."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cc.priority_stat_1 = p
    if "priority_stat_2" in request.data:
        p = _coerce_priority_stat(request.data.get("priority_stat_2"))
        if p is None:
            return Response(
                {"detail": "invalid priority_stat_2."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cc.priority_stat_2 = p
    if cc.priority_stat_1 == cc.priority_stat_2:
        return Response(
            {"detail": "priority_stat_1 and priority_stat_2 must differ."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    for key in (
        "starter_chest_item_id",
        "starter_main_hand_item_id",
    ):
        if key in request.data:
            pk_val = _parse_optional_item_pk(request.data.get(key))
            setattr(cc, key, pk_val)
    err = _validate_class_starter_slots(
        {
            "starter_chest_item_id": cc.starter_chest_item_id,
            "starter_main_hand_item_id": cc.starter_main_hand_item_id,
        }
    )
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    if "extra_data" in request.data:
        extra = _parse_extra_data(request.data.get("extra_data"))
        if extra is None:
            return Response(
                {"detail": "extra_data must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cc.extra_data = extra
    try:
        cc.save()
    except IntegrityError:
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_dm_class_dict(cc))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_ineffective_inputs_list(request):
    try:
        limit = min(int(request.query_params.get("limit", 100)), 500)
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except ValueError:
        return Response(
            {"detail": "Invalid limit or offset."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    qs = QffIneffectiveInput.objects.order_by("-created_at")[offset : offset + limit]
    total = QffIneffectiveInput.objects.count()
    return Response(
        {
            "count": total,
            "results": [
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "user_email": row.user_email,
                    "raw_line": row.raw_line,
                    "room_id": row.room_id,
                    "room_name": row.room_name or "",
                    "created_at": row.created_at.isoformat(),
                }
                for row in qs
            ],
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_ineffective_input_detail(request, pk):
    row = get_object_or_404(QffIneffectiveInput, pk=pk)
    row.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
