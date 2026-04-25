"""Player-facing harbor endpoints.

GET/POST /api/v1/harbor/state/   - per-user save blob
GET      /api/v1/harbor/catalog/ - all enabled catalog rows for runtime use
GET      /api/v1/harbor/staff/schema/ - canonical enum lists for the editor

Staff CRUD endpoints live in `staff_content.py`.
"""

from __future__ import annotations

import json

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsStaffUser

from . import schema_constants
from .models import (
    HARBOR_DEF_MODELS,
    HarborCatalogVersion,
    HarborGameSave,
)

MAX_STATE_BYTES = 256 * 1024


def _server_time_payload():
    return {"server_time": timezone.now().isoformat()}


def _serialize_save(row: HarborGameSave):
    return {
        "state": row.state,
        "schema_version": row.schema_version,
        "catalog_version": row.catalog_version,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "last_played_at": row.last_played_at.isoformat() if row.last_played_at else None,
    }


def _current_catalog_version() -> int:
    row = HarborCatalogVersion.objects.filter(id=1).first()
    if row is None:
        return 0
    return int(row.version)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def game_state(request):
    if request.method == "GET":
        try:
            row = HarborGameSave.objects.get(user=request.user)
        except HarborGameSave.DoesNotExist:
            return Response(
                {
                    "state": None,
                    "schema_version": 1,
                    "catalog_version": 0,
                    "created_at": None,
                    "updated_at": None,
                    "last_played_at": None,
                    "current_catalog_version": _current_catalog_version(),
                    **_server_time_payload(),
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                **_serialize_save(row),
                "current_catalog_version": _current_catalog_version(),
                **_server_time_payload(),
            }
        )

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

    catalog_version = body.get("catalog_version", 0)
    try:
        catalog_version = int(catalog_version)
    except (TypeError, ValueError):
        catalog_version = 0
    if catalog_version < 0:
        catalog_version = 0

    now = timezone.now()
    row, _created = HarborGameSave.objects.update_or_create(
        user=request.user,
        defaults={
            "state": state,
            "schema_version": schema_version,
            "catalog_version": catalog_version,
            "last_played_at": now,
        },
    )
    row.refresh_from_db()
    return Response(
        {
            **_serialize_save(row),
            "current_catalog_version": _current_catalog_version(),
            **_server_time_payload(),
        }
    )


def _def_dict(row) -> dict:
    return {
        "id": row.id,
        "slug": row.slug,
        "name": row.name,
        "description": row.description,
        "stage_min": row.stage_min,
        "stage_max": row.stage_max,
        "tags": row.tags or [],
        "extra": row.extra or {},
        "enabled": row.enabled,
        "sort_order": row.sort_order,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


# Maps URL segment -> model class. Used by player catalog and staff CRUD.
DEF_MODEL_BY_SLUG = {
    "ships": HARBOR_DEF_MODELS[0],
    "buildings": HARBOR_DEF_MODELS[1],
    "operations": HARBOR_DEF_MODELS[2],
    "arrivals": HARBOR_DEF_MODELS[3],
    "events": HARBOR_DEF_MODELS[4],
    "consequences": HARBOR_DEF_MODELS[5],
    "policies": HARBOR_DEF_MODELS[6],
    "doctrines": HARBOR_DEF_MODELS[7],
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog(request):
    """Return all enabled catalog rows the player needs to run the engine."""
    payload = {"catalog_version": _current_catalog_version()}
    for url_slug, model_cls in DEF_MODEL_BY_SLUG.items():
        rows = model_cls.objects.filter(enabled=True).order_by("sort_order", "slug")
        payload[url_slug] = [_def_dict(r) for r in rows]
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_schema(request):
    """Canonical enum lists for the staff editor UI."""
    return Response(
        {
            "resources": schema_constants.RESOURCES,
            "metrics": schema_constants.METRICS,
            "voyage_types": schema_constants.VOYAGE_TYPES,
            "operation_kinds": schema_constants.OPERATION_KINDS,
            "ship_roles": schema_constants.SHIP_ROLES,
            "building_districts": schema_constants.BUILDING_DISTRICTS,
            "arrival_kinds": schema_constants.ARRIVAL_KINDS,
            "event_severities": schema_constants.EVENT_SEVERITIES,
            "consequence_source_kinds": schema_constants.CONSEQUENCE_SOURCE_KINDS,
            "pressure_bands": schema_constants.PRESSURE_BANDS,
            "stages": schema_constants.STAGES,
        }
    )
