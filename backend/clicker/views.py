import json

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from achievements.services import evaluate_pondclicker_achievements_for_user

from .models import ClickerGameSave

MAX_STATE_BYTES = 256 * 1024


def _server_time_payload():
    return {"server_time": timezone.now().isoformat()}


def _serialize_save(row: ClickerGameSave):
    return {
        "state": row.state,
        "schema_version": row.schema_version,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "last_played_at": row.last_played_at.isoformat() if row.last_played_at else None,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def game_state(request):
    if request.method == "GET":
        try:
            row = ClickerGameSave.objects.get(user=request.user)
        except ClickerGameSave.DoesNotExist:
            return Response(
                {
                    "state": None,
                    "schema_version": 1,
                    "created_at": None,
                    "updated_at": None,
                    "last_played_at": None,
                    **_server_time_payload(),
                },
                status=status.HTTP_200_OK,
            )
        return Response({**_serialize_save(row), **_server_time_payload()})

    # POST
    raw = request.body
    if len(raw) > MAX_STATE_BYTES:
        return Response(
            {"detail": "State payload too large."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        body = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        return Response(
            {"detail": "Invalid JSON."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    state = body.get("state")
    if state is None:
        return Response(
            {"detail": 'Missing "state" field.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not isinstance(state, dict):
        return Response(
            {"detail": '"state" must be a JSON object.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    schema_version = body.get("schema_version", 1)
    try:
        schema_version = int(schema_version)
    except (TypeError, ValueError):
        return Response(
            {"detail": '"schema_version" must be a positive integer.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if schema_version < 1:
        return Response(
            {"detail": '"schema_version" must be >= 1.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    row, _created = ClickerGameSave.objects.update_or_create(
        user=request.user,
        defaults={
            "state": state,
            "schema_version": schema_version,
            "last_played_at": now,
        },
    )
    row.refresh_from_db()
    badges_unlocked = evaluate_pondclicker_achievements_for_user(request.user.pk, state)
    return Response(
        {
            **_serialize_save(row),
            "pondclicker_badges_unlocked": badges_unlocked,
            **_server_time_payload(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "clicker", "ok": True})
