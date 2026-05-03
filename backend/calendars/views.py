from __future__ import annotations

import logging
from datetime import date, timedelta

from achievements.services import evaluate_schedule_coordinator_for_user
from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from calendars.models import CalendarSource, Event
from calendars.serializers import (
    CalendarSourceCreateSerializer,
    CalendarSourceSerializer,
    EventSerializer,
    EventWriteSerializer,
    _owner_row,
)
from calendars.services import (
    IcalFetchError,
    IcalParseError,
    LAZY_REFRESH_MAX_AGE,
    ensure_manual_source,
    sync_ical_source,
)
from users.permissions import IsApprovedUser
from users.models import Profile

logger = logging.getLogger(__name__)

User = get_user_model()

# How far in either direction we'll accept in a single `GET /events/` query.
MAX_RANGE_DAYS = 366


def _approved_users_qs():
    return (
        User.objects.select_related("profile")
        .filter(
            account_status=User.AccountStatus.APPROVED,
            deleted_at__isnull=True,
        )
    )


def _parse_date_param(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw.strip())
    except ValueError:
        return None


def _parse_owner_ids(raw: str | None) -> list[int] | None:
    """Parse a comma-separated owner_ids list. Returns None if not provided."""
    if raw is None or raw == "":
        return None
    out: list[int] = []
    for piece in raw.split(","):
        piece = piece.strip()
        if not piece:
            continue
        try:
            out.append(int(piece))
        except ValueError:
            return None
    return out


def _events_list_get(request):
    start_date = _parse_date_param(request.query_params.get("start_date"))
    end_date = _parse_date_param(request.query_params.get("end_date"))
    if start_date is None or end_date is None:
        return Response(
            {"detail": "start_date and end_date query params (YYYY-MM-DD) are required."},
            status=400,
        )
    if end_date < start_date:
        return Response({"detail": "end_date must be on or after start_date."}, status=400)
    if (end_date - start_date) > timedelta(days=MAX_RANGE_DAYS):
        return Response(
            {"detail": f"Range cannot exceed {MAX_RANGE_DAYS} days."},
            status=400,
        )

    owner_param = (request.query_params.get("owner") or "all").strip().lower()
    owner_ids = _parse_owner_ids(request.query_params.get("owner_ids"))
    user = request.user

    owner_filter = Q()
    if owner_param == "me":
        owner_filter = Q(owner=user)
    elif owner_param == "all":
        owner_filter = Q(
            owner__account_status=User.AccountStatus.APPROVED,
            owner__deleted_at__isnull=True,
        )
    else:
        try:
            owner_id = int(owner_param)
        except ValueError:
            return Response(
                {"detail": "owner must be 'me', 'all', or a user id."},
                status=400,
            )
        target = _approved_users_qs().filter(pk=owner_id).first()
        if target is None:
            return Response({"detail": "That user is not available."}, status=404)
        owner_filter = Q(owner=target)

    if owner_ids is None:
        if request.query_params.get("owner_ids") is not None:
            return Response(
                {"detail": "owner_ids must be a comma-separated list of integers."},
                status=400,
            )
        owner_id_filter = Q()
    else:
        # Restrict to approved owners only — clients can't peek at suspended
        # or deleted users by enumerating ids.
        approved_ids = set(_approved_users_qs().values_list("id", flat=True))
        kept = [oid for oid in owner_ids if oid in approved_ids]
        if not kept:
            return Response({"results": []})
        owner_id_filter = Q(owner_id__in=kept)

    events_qs = (
        Event.objects.select_related("owner", "owner__profile", "source")
        .filter(owner_filter)
        .filter(owner_id_filter)
        .filter(start_date__lte=end_date, end_date__gte=start_date)
        .order_by("start_date", "id")[:2_000]
    )

    # Opportunistic lazy refresh: if any iCal source contributing to this view is
    # stale, kick off a sync inline. For v1 we cap to a handful of sources per
    # request so a single pageview never pays for dozens of HTTP round-trips.
    threshold = timezone.now() - LAZY_REFRESH_MAX_AGE
    owner_ids_for_refresh = set(events_qs.values_list("owner_id", flat=True))
    owner_ids_for_refresh.add(user.id)
    stale_sources = list(
        CalendarSource.objects.filter(
            owner_id__in=owner_ids_for_refresh,
            is_active=True,
            source_type=CalendarSource.SourceType.ICAL,
        )
        .filter(Q(last_synced_at__isnull=True) | Q(last_synced_at__lt=threshold))
        .order_by("last_synced_at")[:5]
    )
    refreshed_any = False
    for src in stale_sources:
        try:
            sync_ical_source(src)
            refreshed_any = True
        except Exception:
            logger.exception("Lazy iCal refresh failed for source=%s", src.id)

    if refreshed_any:
        events_qs = (
            Event.objects.select_related("owner", "owner__profile", "source")
            .filter(owner_filter)
            .filter(owner_id_filter)
            .filter(start_date__lte=end_date, end_date__gte=start_date)
            .order_by("start_date", "id")[:2_000]
        )

    return Response(
        {
            "results": EventSerializer(
                events_qs, many=True, context={"request": request}
            ).data,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def events_list(request):
    if request.method == "POST":
        return _create_event(request)

    return _events_list_get(request)


def _create_event(request):
    serializer = EventWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    source = ensure_manual_source(request.user)
    event = Event.objects.create(
        owner=request.user,
        source=source,
        title=serializer.validated_data.get("title", ""),
        start_date=serializer.validated_data["start_date"],
        end_date=serializer.validated_data["end_date"],
    )
    return Response(
        EventSerializer(event, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsApprovedUser])
def event_detail(request, event_id: int):
    event = get_object_or_404(
        Event.objects.select_related("owner", "source"),
        pk=event_id,
    )
    if event.owner_id != request.user.id:
        return Response({"detail": "Not your event."}, status=403)
    if event.source.source_type != CalendarSource.SourceType.MANUAL:
        return Response(
            {"detail": "Imported events are read-only; edit them in Google Calendar."},
            status=400,
        )

    if request.method == "DELETE":
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = EventWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    event.title = serializer.validated_data.get("title", "")
    event.start_date = serializer.validated_data["start_date"]
    event.end_date = serializer.validated_data["end_date"]
    event.save(update_fields=["title", "start_date", "end_date", "updated_at"])
    return Response(EventSerializer(event, context={"request": request}).data)


def _sources_list_get(request):
    qs = (
        CalendarSource.objects.select_related("owner", "owner__profile")
        .filter(owner=request.user)
        .order_by("source_type", "display_name")
    )
    return Response({"results": CalendarSourceSerializer(qs, many=True).data})


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def sources_list(request):
    if request.method == "POST":
        return _create_source(request)

    return _sources_list_get(request)


def _create_source(request):
    serializer = CalendarSourceCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    url = serializer.validated_data["ical_url"]
    display_name = serializer.validated_data["display_name"]
    color = serializer.validated_data["color"]

    if CalendarSource.objects.filter(owner=request.user, ical_url=url).exists():
        return Response(
            {"detail": "You've already imported that calendar URL."},
            status=400,
        )

    source = CalendarSource.objects.create(
        owner=request.user,
        source_type=CalendarSource.SourceType.ICAL,
        display_name=display_name,
        ical_url=url,
        color=color,
    )
    try:
        result = sync_ical_source(source)
    except (IcalFetchError, IcalParseError) as exc:  # pragma: no cover - defensive
        source.delete()
        return Response({"detail": str(exc)}, status=400)
    if not result.ok:
        # Initial sync couldn't validate the feed; drop the row so the user sees
        # an actionable error rather than a broken source that lingers.
        source.delete()
        message = result.error or "Could not read that iCal URL."
        if "Only iCal sources" in message or "no iCal URL" in message:
            message = "Could not read that iCal URL."
        if "404" in message or "401" in message or "403" in message:
            message = "Google returned an error for that iCal URL."
        return Response({"detail": message}, status=400)

    evaluate_schedule_coordinator_for_user(request.user.id)
    return Response(
        {
            "source": CalendarSourceSerializer(source).data,
            "synced": {
                "created": result.created,
                "updated": result.updated,
                "deleted": result.deleted,
                "not_modified": result.not_modified,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE", "POST"])
@permission_classes([IsApprovedUser])
def source_detail(request, source_id: int):
    source = get_object_or_404(CalendarSource, pk=source_id, owner=request.user)
    if request.method == "DELETE":
        if source.source_type == CalendarSource.SourceType.MANUAL:
            return Response(
                {"detail": "The manual source cannot be deleted."},
                status=400,
            )
        source.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    # POST = explicit refresh.
    if source.source_type != CalendarSource.SourceType.ICAL:
        return Response({"detail": "Only iCal sources can be refreshed."}, status=400)
    result = sync_ical_source(source)
    if not result.ok:
        return Response(
            {"detail": result.error or "Sync failed."},
            status=400,
        )
    evaluate_schedule_coordinator_for_user(request.user.id)
    return Response(
        {
            "source": CalendarSourceSerializer(source).data,
            "synced": {
                "created": result.created,
                "updated": result.updated,
                "deleted": result.deleted,
                "not_modified": result.not_modified,
            },
        }
    )


def _approved_users_list_get(request):
    """Approved users visible in the calendar people filter (see filter below)."""
    search = (request.query_params.get("q") or "").strip()
    today = timezone.localdate()
    linked_sources = CalendarSource.objects.filter(
        owner_id=OuterRef("pk"),
        is_active=True,
        source_type__in=(
            CalendarSource.SourceType.ICAL,
            CalendarSource.SourceType.GOOGLE_OAUTH,
        ),
    )
    upcoming_events = Event.objects.filter(
        owner_id=OuterRef("pk"),
        end_date__gte=today,
    )
    qs = (
        _approved_users_qs()
        .annotate(
            _has_linked=Exists(linked_sources),
            _has_upcoming=Exists(upcoming_events),
        )
        .filter(
            Q(pk=request.user.pk)
            | Q(_has_linked=True)
            | Q(_has_upcoming=True),
        )
        .order_by("profile__display_name", "email")
    )
    # Viewer read preference: when friends-only, show only friends (plus self) in the picker.
    viewer_profile = getattr(request.user, "profile", None)
    scope = getattr(viewer_profile, "social_read_scope", None) or Profile.SocialReadScope.APPROVED_USERS
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        from friends.services import friend_ids_for_user

        fids = friend_ids_for_user(user=request.user)
        allowed = set(fids or set())
        allowed.add(request.user.pk)
        qs = qs.filter(pk__in=list(allowed))
    if search:
        qs = qs.filter(
            Q(email__icontains=search) | Q(profile__display_name__icontains=search)
        )
    qs = qs[:200]
    return Response({"results": [_owner_row(u) for u in qs]})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def approved_users_list(request):
    return _approved_users_list_get(request)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def calendar_bootstrap(request):
    """
    Single round-trip for calendar month view: events (same query params as GET /events/)
    plus sources and approved users (same as GET /sources/ and GET /approved-users/).
    """
    ev = _events_list_get(request)
    if ev.status_code >= 400:
        return ev
    src = _sources_list_get(request)
    appr = _approved_users_list_get(request)
    return Response(
        {
            "events": ev.data.get("results", []),
            "sources": src.data.get("results", []),
            "approved_users": appr.data.get("results", []),
        }
    )
