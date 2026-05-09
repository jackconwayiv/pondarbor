from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.models import Profile, User
from users.permissions import IsApprovedUser, IsStaffUser
from zodiac.models import AstroProfile
from zodiac.parsers.chart_export_v1 import parse_chart_export_v1
from zodiac.services import (
    apply_birth_payload,
    birth_key_from_model,
    coerce_birth_fields,
    parse_birth_payload,
    serialize_astro_profile,
    signs_from_natal_chart,
)


def _validate_birth_required(fields: dict) -> str | None:
    """Return error message or None if ok."""
    if not fields.get("birth_date"):
        return "birth_date is required."
    if not (fields.get("locality") or "").strip():
        return "locality (city) is required."
    if not (fields.get("admin_area") or "").strip():
        return "admin_area (state) is required."
    if not (fields.get("country_code") or "").strip():
        return "country_code is required."
    return None


@api_view(["GET", "PUT"])
@permission_classes([IsApprovedUser])
def user_astro_profile(request):
    """GET or upsert birth data for the current user's astro profile."""
    user = request.user

    if request.method == "GET":
        try:
            profile = AstroProfile.objects.get(user=user)
        except AstroProfile.DoesNotExist:
            return Response({"profile": None}, status=status.HTTP_200_OK)
        return Response({"profile": serialize_astro_profile(profile)})

    # PUT
    data = request.data if isinstance(request.data, dict) else {}
    fields = coerce_birth_fields(parse_birth_payload(data))
    err = _validate_birth_required(fields)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

    profile, created = AstroProfile.objects.get_or_create(
        user=user,
        defaults={"chart_status": AstroProfile.ChartStatus.WAITING_STAFF_CHART},
    )

    old_key = birth_key_from_model(profile)
    was_ready = profile.chart_status == AstroProfile.ChartStatus.READY

    apply_birth_payload(profile, fields)

    new_key = birth_key_from_model(profile)

    if was_ready and old_key != new_key:
        profile.chart_status = AstroProfile.ChartStatus.WAITING_STAFF_CHART
        profile.natal_chart = None
        profile.sun_sign = ""
        profile.moon_sign = ""
        profile.rising_sign = ""
        profile.chart_ready_at = None
        profile.staff_imported_by = None
        profile.waiting_submitted_at = timezone.now()
    elif was_ready and old_key == new_key:
        pass
    else:
        profile.chart_status = AstroProfile.ChartStatus.WAITING_STAFF_CHART
        if created or not profile.waiting_submitted_at:
            profile.waiting_submitted_at = timezone.now()

    profile.save()

    return Response({"profile": serialize_astro_profile(profile)})


@api_view(["GET"])
@permission_classes([IsStaffUser])
def staff_pending_charts(request):
    rows = (
        AstroProfile.objects.filter(
            chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART
        )
        .select_related("user")
        .order_by("waiting_submitted_at", "id")
    )
    out = []
    for p in rows:
        u = p.user
        prof = Profile.objects.filter(user=u).first()
        display_name = (prof.display_name or "").strip() if prof else ""
        out.append(
            {
                "user_id": u.id,
                "email": u.email,
                "display_name": display_name,
                "birth_date": p.birth_date.isoformat() if p.birth_date else None,
                "birth_time": p.birth_time.isoformat() if p.birth_time else None,
                "locality": p.locality,
                "admin_area": p.admin_area,
                "country_code": p.country_code,
                "postal_code": p.postal_code,
                "waiting_submitted_at": p.waiting_submitted_at.isoformat()
                if p.waiting_submitted_at
                else None,
            }
        )
    return Response({"pending": out})


@api_view(["GET"])
@permission_classes([IsStaffUser])
def staff_imported_charts(request):
    """Profiles with a staff-imported chart ready (for review / revise / undo)."""
    rows = (
        AstroProfile.objects.filter(chart_status=AstroProfile.ChartStatus.READY)
        .select_related("user")
        .order_by("-chart_ready_at", "id")
    )
    out = []
    for p in rows:
        u = p.user
        prof = Profile.objects.filter(user=u).first()
        display_name = (prof.display_name or "").strip() if prof else ""
        row = {
            "user_id": u.id,
            "email": u.email,
            "display_name": display_name,
        }
        row.update(serialize_astro_profile(p))
        out.append(row)
    return Response({"imported": out})


@api_view(["POST", "DELETE"])
@permission_classes([IsStaffUser])
def staff_user_chart(request, user_id: int):
    """POST: parse paste and save chart. DELETE: remove import and return user to waiting."""
    target = get_object_or_404(User, pk=user_id)
    profile = get_object_or_404(AstroProfile, user=target)

    if request.method == "DELETE":
        if profile.chart_status != AstroProfile.ChartStatus.READY:
            return Response(
                {"detail": "No imported chart to remove for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.natal_chart = None
        profile.sun_sign = ""
        profile.moon_sign = ""
        profile.rising_sign = ""
        profile.chart_status = AstroProfile.ChartStatus.WAITING_STAFF_CHART
        profile.chart_ready_at = None
        profile.staff_imported_by = None
        profile.waiting_submitted_at = timezone.now()
        profile.save()
        return Response({"profile": serialize_astro_profile(profile)})

    # POST — import or replace chart
    text = ""
    if isinstance(request.data, dict):
        text = request.data.get("chart_text") or ""
    if not isinstance(text, str) or not text.strip():
        return Response(
            {"detail": 'Missing non-empty "chart_text".'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(text) > 128 * 1024:
        return Response(
            {"detail": "chart_text too large."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        natal_chart, warnings = parse_chart_export_v1(text)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    sun_s, moon_s, rising_s = signs_from_natal_chart(natal_chart)

    profile.natal_chart = natal_chart
    profile.sun_sign = sun_s
    profile.moon_sign = moon_s
    profile.rising_sign = rising_s
    profile.chart_status = AstroProfile.ChartStatus.READY
    profile.chart_ready_at = timezone.now()
    profile.staff_imported_by = request.user
    profile.save()

    return Response(
        {
            "profile": serialize_astro_profile(profile),
            "warnings": warnings,
        }
    )
