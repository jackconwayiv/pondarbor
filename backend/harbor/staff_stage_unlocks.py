"""Staff GET/PATCH for `HarborStageUnlock` rows (stage progression copy + gates)."""

from __future__ import annotations

from typing import Any, Optional

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsStaffUser

from .models import HarborStageUnlock
from .views import _stage_unlock_catalog_dict


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_str_list(value: Any) -> list:
    if isinstance(value, list):
        return [str(v) for v in value if isinstance(v, (str, int, float))]
    return []


def _apply_stage_unlock(row: HarborStageUnlock, data: dict) -> None:
    if "title" in data:
        row.title = (data.get("title") or "").strip()[:120]
    if "era" in data:
        row.era = (data.get("era") or "").strip()[:120]
    if "age_question" in data:
        row.age_question = data.get("age_question") or ""
    if "core_tension" in data:
        row.core_tension = data.get("core_tension") or ""
    if "main_lesson" in data:
        row.main_lesson = data.get("main_lesson") or ""
    if "resources" in data:
        row.resources = _coerce_str_list(data.get("resources"))
    if "metrics" in data:
        row.metrics = _coerce_str_list(data.get("metrics"))
    if "voyage_types" in data:
        row.voyage_types = _coerce_str_list(data.get("voyage_types"))
    if "panels" in data:
        row.panels = _coerce_str_list(data.get("panels"))
    if "content_tags" in data:
        row.content_tags = _coerce_str_list(data.get("content_tags"))
    if "doctrine_unlocked" in data:
        row.doctrine_unlocked = bool(data.get("doctrine_unlocked"))
    if "base_command_per_day" in data:
        v = _coerce_optional_int(data.get("base_command_per_day"))
        row.base_command_per_day = v


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_stage_unlock_list(request):
    rows = HarborStageUnlock.objects.order_by("stage_id")
    return Response([_stage_unlock_catalog_dict(r) for r in rows])


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_stage_unlock_detail(request, stage_id: int):
    row = get_object_or_404(HarborStageUnlock, pk=stage_id)

    if request.method == "GET":
        return Response(_stage_unlock_catalog_dict(row))

    data = request.data or {}
    _apply_stage_unlock(row, data)
    row.save()
    return Response(_stage_unlock_catalog_dict(row), status=status.HTTP_200_OK)
