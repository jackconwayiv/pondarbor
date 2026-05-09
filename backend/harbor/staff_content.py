"""Staff CRUD endpoints for the nine harbor catalog def tables.

A single pair of view functions handles list/create and detail for every
catalog table; the URL captures `<def_type>` and we look up the model class.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsStaffUser

from .views import DEF_MODEL_BY_SLUG, _def_dict


def _resolve_model(def_type: str):
    model_cls = DEF_MODEL_BY_SLUG.get(def_type)
    if model_cls is None:
        return None
    return model_cls


def _coerce_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_list(value: Any) -> list:
    if isinstance(value, list):
        return [v for v in value if isinstance(v, (str, int, float, bool))]
    return []


def _coerce_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    return {}


def _apply_writable(row, data: dict) -> None:
    if "name" in data:
        row.name = (data.get("name") or "").strip()[:120]
    if "description" in data:
        row.description = data.get("description") or ""
    if "stage_min" in data:
        row.stage_min = max(1, min(12, _coerce_int(data.get("stage_min"), 1)))
    if "stage_max" in data:
        row.stage_max = _coerce_optional_int(data.get("stage_max"))
        if row.stage_max is not None:
            row.stage_max = max(1, min(12, row.stage_max))
    if "tags" in data:
        row.tags = _coerce_list(data.get("tags"))
    if "extra" in data:
        row.extra = _coerce_dict(data.get("extra"))
    if "enabled" in data:
        row.enabled = bool(data.get("enabled"))
    if "sort_order" in data:
        row.sort_order = _coerce_int(data.get("sort_order"), 0)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_def_list_create(request, def_type: str):
    model_cls = _resolve_model(def_type)
    if model_cls is None:
        return Response({"detail": "Unknown def type."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        rows = model_cls.objects.all().order_by("sort_order", "slug")
        return Response([_def_dict(r) for r in rows])

    data = request.data or {}
    slug = (data.get("slug") or "").strip()[:80]
    name = (data.get("name") or "").strip()[:120]
    if not slug or not name:
        return Response(
            {"detail": "slug and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        row = model_cls(slug=slug, name=name)
        _apply_writable(row, data)
        row.save()
    except IntegrityError:
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_def_dict(row), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_def_detail(request, def_type: str, pk: int):
    model_cls = _resolve_model(def_type)
    if model_cls is None:
        return Response({"detail": "Unknown def type."}, status=status.HTTP_404_NOT_FOUND)

    row = get_object_or_404(model_cls, pk=pk)

    if request.method == "GET":
        return Response(_def_dict(row))

    if request.method == "DELETE":
        row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    data = request.data or {}
    if "slug" in data:
        new_slug = (data.get("slug") or "").strip()[:80]
        if not new_slug:
            return Response(
                {"detail": "slug cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        row.slug = new_slug
    _apply_writable(row, data)
    try:
        row.save()
    except IntegrityError:
        return Response(
            {"detail": "That slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_def_dict(row))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_def_export(request, def_type: str):
    model_cls = _resolve_model(def_type)
    if model_cls is None:
        return Response({"detail": "Unknown def type."}, status=status.HTTP_404_NOT_FOUND)
    rows = model_cls.objects.all().order_by("sort_order", "slug")
    return Response(
        {
            "def_type": def_type,
            "rows": [
                {
                    "slug": r.slug,
                    "name": r.name,
                    "description": r.description,
                    "stage_min": r.stage_min,
                    "stage_max": r.stage_max,
                    "tags": r.tags or [],
                    "extra": r.extra or {},
                    "enabled": r.enabled,
                    "sort_order": r.sort_order,
                }
                for r in rows
            ],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_def_import(request, def_type: str):
    """Idempotent upsert by slug. Each row creates or updates by slug."""
    model_cls = _resolve_model(def_type)
    if model_cls is None:
        return Response({"detail": "Unknown def type."}, status=status.HTTP_404_NOT_FOUND)

    raw = request.body
    try:
        body = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        return Response({"detail": "Invalid JSON."}, status=status.HTTP_400_BAD_REQUEST)

    rows = body.get("rows")
    if not isinstance(rows, list):
        return Response(
            {"detail": '"rows" must be a JSON array.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    created = 0
    updated = 0
    errors: list[dict] = []
    for idx, raw_row in enumerate(rows):
        if not isinstance(raw_row, dict):
            errors.append({"index": idx, "detail": "Row must be an object."})
            continue
        slug = (raw_row.get("slug") or "").strip()[:80]
        name = (raw_row.get("name") or "").strip()[:120]
        if not slug or not name:
            errors.append({"index": idx, "detail": "slug and name are required."})
            continue
        instance, was_created = model_cls.objects.get_or_create(
            slug=slug, defaults={"name": name}
        )
        if not was_created:
            instance.name = name
        _apply_writable(instance, raw_row)
        try:
            instance.save()
        except IntegrityError as exc:
            errors.append({"index": idx, "detail": str(exc)})
            continue
        if was_created:
            created += 1
        else:
            updated += 1

    return Response({"created": created, "updated": updated, "errors": errors})
