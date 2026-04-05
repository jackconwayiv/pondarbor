from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser, IsStaffUser

from qff.command_parser import ParsedMove, ParsedSearch, ParsedUnknown, parse_command
from qff.exploration import mark_exit_used, on_enter_room
from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    Room,
    RoomExit,
    validate_character_name,
)
from qff.session_payload import (
    build_session_for_character,
    normalize_hex_color,
    resolved_area_theme,
)

def _get_character(user):
    try:
        return Character.objects.select_related(
            "character_class",
            "current_room",
            "current_room__area",
            "spawn_room",
        ).get(user=user)
    except Character.DoesNotExist:
        return None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def session_view(request):
    char = _get_character(request.user)
    if not char:
        classes = list(
            CharacterClass.objects.order_by("sort_order", "name").values(
                "id", "slug", "name"
            )
        )
        return Response(
            {
                "has_character": False,
                "character_classes": classes,
            }
        )
    return Response(build_session_for_character(char))


def _starting_room():
    return Room.objects.select_related("area").get(
        area__slug="village-of-ort",
        name="Village Well",
    )


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
    class_slug = (body.get("character_class") or body.get("class") or "").strip()

    try:
        validate_character_name(name)
    except ValidationError as e:
        msg = e.messages[0] if e.messages else "Invalid name."
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

    cc = CharacterClass.objects.filter(slug=class_slug).first()
    if not cc:
        return Response(
            {"detail": "Invalid character class."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    try:
        room = _starting_room()
    except Room.DoesNotExist:
        return Response(
            {"detail": "Game world is not seeded."},
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
            )
            char.save()
            on_enter_room(char, room.id)
    except IntegrityError:
        return Response(
            {"detail": "That name is already taken."},
            status=status.HTTP_400_BAD_REQUEST,
        )

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
            {"messages": ["Type a command."], "session": build_session_for_character(char)},
        )

    parsed = parse_command(line)
    messages = []

    if isinstance(parsed, ParsedSearch):
        char.last_activity_at = timezone.now()
        char.save(update_fields=["last_activity_at", "updated_at"])
        room = char.current_room
        if room.search_text.strip():
            messages.append(room.search_text.strip())
        else:
            messages.append(
                f"You spend some time searching the {room.name} but find nothing of note."
            )
        return Response({"messages": messages, "session": build_session_for_character(char)})

    if isinstance(parsed, ParsedUnknown):
        messages.append("You try that, but nothing happens.")
        return Response({"messages": messages, "session": build_session_for_character(char)})

    if isinstance(parsed, ParsedMove):
        ex = (
            RoomExit.objects.select_related("to_room")
            .filter(
                from_room=char.current_room,
                direction=parsed.direction,
            )
            .first()
        )
        if not ex:
            messages.append("You can't go that way.")
            char.last_activity_at = timezone.now()
            char.save(update_fields=["last_activity_at", "updated_at"])
            return Response({"messages": messages, "session": build_session_for_character(char)})

        if ex.is_hidden:
            messages.append("You can't go that way.")
            char.last_activity_at = timezone.now()
            char.save(update_fields=["last_activity_at", "updated_at"])
            return Response({"messages": messages, "session": build_session_for_character(char)})

        if ex.lock_kind != RoomExit.LockKind.NONE:
            messages.append("You can't go that way — not yet.")
            char.last_activity_at = timezone.now()
            char.save(update_fields=["last_activity_at", "updated_at"])
            return Response({"messages": messages, "session": build_session_for_character(char)})

        mark_exit_used(char, ex)
        dest = ex.to_room
        char.current_room = dest
        char.last_activity_at = timezone.now()
        char.save(update_fields=["current_room", "last_activity_at", "updated_at"])
        on_enter_room(char, dest.id)
        messages.append(f"You head {ex.get_direction_display().lower()}.")
        return Response({"messages": messages, "session": build_session_for_character(char)})

    messages.append("You try that, but nothing happens.")
    return Response({"messages": messages, "session": build_session_for_character(char)})


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
            "to_room__area"
        ).order_by("direction"):
            to = ex.to_room
            if to.area_id == area.id:
                exits_out.append(
                    {
                        "direction": ex.direction,
                        "to_area_slug": None,
                        "to_room_slug": _dm_export_room_slug(to),
                        "is_hidden": ex.is_hidden,
                        "lock_kind": ex.lock_kind,
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
                    }
                )
        rooms_out.append(
            {
                "id": room.id,
                "slug": _dm_export_room_slug(room),
                "name": room.name,
                "description": room.description,
                "search_text": room.search_text,
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
                room = Room.objects.create(
                    area=area,
                    name=name,
                    slug=slug,
                    description=(rspec.get("description") or "")[:],
                    search_text=(rspec.get("search_text") or "")[:],
                )
            else:
                room.name = name
                room.slug = slug
                room.description = rspec.get("description") or ""
                room.search_text = rspec.get("search_text") or ""
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
                RoomExit.objects.create(
                    from_room=from_room,
                    to_room=to_room,
                    direction=direction,
                    is_hidden=bool(es.get("is_hidden")),
                    lock_kind=lk,
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
    room = Room.objects.create(
        area=area,
        name=name,
        slug=(request.data.get("slug") or "")[:80],
        description=(request.data.get("description") or ""),
        search_text=(request.data.get("search_text") or ""),
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
    room.save()
    return Response(
        {
            "id": room.id,
            "name": room.name,
            "slug": room.slug,
            "description": room.description,
            "search_text": room.search_text,
        }
    )


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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_exit_list_create(request, room_id):
    room = get_object_or_404(Room, pk=room_id)
    if request.method == "GET":
        exits = RoomExit.objects.filter(from_room=room).select_related("to_room")
        return Response(
            [
                {
                    "id": e.id,
                    "direction": e.direction,
                    "to_room_id": e.to_room_id,
                    "to_room_name": e.to_room.name,
                    "is_hidden": e.is_hidden,
                    "lock_kind": e.lock_kind,
                }
                for e in exits
            ]
        )
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
        {
            "id": ex.id,
            "direction": ex.direction,
            "to_room_id": ex.to_room_id,
            "is_hidden": ex.is_hidden,
            "lock_kind": ex.lock_kind,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_exit_detail(request, pk):
    ex = get_object_or_404(
        RoomExit.objects.select_related("from_room", "to_room"), pk=pk
    )
    if request.method == "GET":
        return Response(
            {
                "id": ex.id,
                "from_room_id": ex.from_room_id,
                "direction": ex.direction,
                "to_room_id": ex.to_room_id,
                "is_hidden": ex.is_hidden,
                "lock_kind": ex.lock_kind,
            }
        )
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
    err = _validate_exit_spatial(ex.from_room, ex.to_room, ex.direction)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    ex.save()
    return Response(
        {
            "id": ex.id,
            "direction": ex.direction,
            "to_room_id": ex.to_room_id,
            "is_hidden": ex.is_hidden,
            "lock_kind": ex.lock_kind,
        }
    )
