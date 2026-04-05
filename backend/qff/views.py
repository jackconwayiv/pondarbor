import json

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser, IsStaffUser

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.exploration import on_enter_room
from qff.loadout import apply_starting_loadout
from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    Item,
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


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def session_view(request):
    char = _get_character(request.user)
    if not char:
        classes = list(
            CharacterClass.objects.order_by("sort_order", "name").values(
                "id",
                "slug",
                "name",
                "description",
                "priority_stat_1",
                "priority_stat_2",
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
    """Spawn new characters in the Village Well when `seed_qff` data exists.

    Lowest-PK room was wrong: seed creates Mayor's House before Village Well, so
    ``order_by('pk').first()`` started players in the mayor's house.
    """
    preferred = (
        Room.objects.select_related("area")
        .filter(area__slug="village-of-ort", name="Village Well")
        .first()
    )
    if preferred:
        return preferred
    return Room.objects.select_related("area").order_by("pk").first()


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
            {"messages": ["Type a command."], "session": build_session_for_character(char)},
        )

    parsed = parse_command(line)
    messages = execute_command(char, parsed)
    char = _get_character(request.user)
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
                    "search_chance": r.search_chance,
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
    room.save()
    return Response(
        {
            "id": room.id,
            "name": room.name,
            "slug": room.slug,
            "description": room.description,
            "search_text": room.search_text,
            "search_chance": room.search_chance,
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


def _dm_item_dict(item: Item) -> dict:
    return {
        "id": item.id,
        "slug": item.slug,
        "name": item.name,
        "item_type": item.item_type,
        "slot": item.slot,
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
    }


def _parse_optional_positive_int(val):
    if val is None or val == "":
        return None
    try:
        v = int(val)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


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
    slot = (request.data.get("slot") or "").strip()
    if not slug or not name or not slot:
        return Response(
            {"detail": "slug, name, and slot are required."},
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
    item = Item.objects.create(
        slug=slug[:80],
        name=name[:200],
        item_type=(request.data.get("item_type") or "")[:64],
        slot=slot[:16],
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
        item.slot = (request.data.get("slot") or "")[:16]
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
    ):
        if bf in request.data:
            setattr(item, bf, int(request.data.get(bf) or 0))
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
        if it.slot != slot.value:
            return f"{key} must be a {slot.label} item (got {it.get_slot_display()})."
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
