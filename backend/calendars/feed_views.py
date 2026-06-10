from __future__ import annotations

import secrets

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from calendars.feed_sync import sync_stale_sources_for_owner_ids
from calendars.ical_export import build_subscription_ics, new_subscription_token
from calendars.models import CalendarSubscription
from calendars.views import _visible_calendar_users_qs, _visible_calendar_users_qs_for_viewer
from users.permissions import IsApprovedUser


def _feed_urls_for_request(request, token: str) -> dict[str, str]:
    path = f"/api/v1/calendars/feed/{token}.ics"
    subscribe_url = request.build_absolute_uri(path)
    if not settings.DEBUG and subscribe_url.startswith("http://"):
        subscribe_url = "https://" + subscribe_url[len("http://") :]
    webcal_url = subscribe_url.replace("https://", "webcal://", 1).replace(
        "http://", "webcal://", 1
    )
    return {"subscribe_url": subscribe_url, "webcal_url": webcal_url}


def resolve_subscription_owner_ids(subscription: CalendarSubscription) -> list[int]:
    """Owner ids included in a feed poll — dynamic when include_all_visible."""
    if subscription.include_all_visible:
        return list(
            _visible_calendar_users_qs_for_viewer(subscription.owner).values_list(
                "id", flat=True
            )
        )
    return list(subscription.owner_ids or [])


def _subscription_payload(request, subscription: CalendarSubscription) -> dict:
    urls = _feed_urls_for_request(request, subscription.token)
    return {
        **urls,
        "owner_ids": subscription.owner_ids,
        "include_all_visible": subscription.include_all_visible,
        "updated_at": subscription.updated_at.isoformat(),
    }


def _parse_include_all_visible(raw) -> bool | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    return None


def _validate_feed_post(
    request,
    *,
    include_all_visible: bool,
    owner_ids: list,
) -> tuple[bool, list[int] | None, Response | None]:
    if include_all_visible:
        visible_ids = list(_visible_calendar_users_qs(request).values_list("id", flat=True))
        if not visible_ids:
            return True, [], Response(
                {"detail": "No visible people are available for an all-people feed."},
                status=400,
            )
        return True, [], None

    if not isinstance(owner_ids, list):
        return False, None, Response(
            {"detail": "owner_ids must be a list of integers."}, status=400
        )
    parsed: list[int] = []
    for raw in owner_ids:
        if isinstance(raw, bool) or not isinstance(raw, int):
            return False, None, Response(
                {"detail": "owner_ids must be a list of integers."}, status=400
            )
        parsed.append(raw)
    if not parsed:
        return False, None, Response({"detail": "Select at least one person."}, status=400)
    visible_ids = set(_visible_calendar_users_qs(request).values_list("id", flat=True))
    kept = [oid for oid in parsed if oid in visible_ids]
    if not kept:
        return False, None, Response(
            {"detail": "No selected people are available."}, status=400
        )
    if len(kept) != len(parsed):
        return False, None, Response(
            {"detail": "One or more selected people are not available."}, status=400
        )
    return False, kept, None


def _get_or_create_subscription(user) -> CalendarSubscription:
    subscription, _created = CalendarSubscription.objects.get_or_create(
        owner=user,
        defaults={"token": new_subscription_token(), "owner_ids": []},
    )
    return subscription


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def calendar_feed_manage(request):
    if request.method == "GET":
        subscription = CalendarSubscription.objects.filter(owner=request.user).first()
        if subscription is None:
            return Response({"detail": "No subscription yet."}, status=404)
        return Response(_subscription_payload(request, subscription))

    include_all_raw = _parse_include_all_visible(request.data.get("include_all_visible"))
    if include_all_raw is None and "include_all_visible" in request.data:
        return Response(
            {"detail": "include_all_visible must be a boolean."}, status=400
        )

    existing = CalendarSubscription.objects.filter(owner=request.user).first()
    if include_all_raw is None:
        if existing is not None:
            include_all_visible = existing.include_all_visible
        else:
            include_all_visible = False
    else:
        include_all_visible = include_all_raw

    owner_ids = request.data.get("owner_ids", [])
    include_all, kept, error = _validate_feed_post(
        request,
        include_all_visible=include_all_visible,
        owner_ids=owner_ids,
    )
    if error is not None:
        return error

    subscription = _get_or_create_subscription(request.user)
    subscription.include_all_visible = include_all_visible
    subscription.owner_ids = [] if include_all else kept
    subscription.save(update_fields=["include_all_visible", "owner_ids", "updated_at"])
    return Response(_subscription_payload(request, subscription))


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def calendar_feed_reset(request):
    subscription = CalendarSubscription.objects.filter(owner=request.user).first()
    if subscription is None:
        subscription = CalendarSubscription.objects.create(
            owner=request.user,
            token=new_subscription_token(),
            owner_ids=[],
        )
    else:
        subscription.token = new_subscription_token()
        subscription.save(update_fields=["token", "updated_at"])
    return Response(_subscription_payload(request, subscription))


@api_view(["GET", "HEAD"])
@permission_classes([AllowAny])
def calendar_feed_ics(request, token: str):
    subscription = get_object_or_404(
        CalendarSubscription.objects.select_related("owner", "owner__profile"),
        token=token,
    )
    owner_ids = resolve_subscription_owner_ids(subscription)
    sync_stale_sources_for_owner_ids(owner_ids)
    body, etag = build_subscription_ics(
        subscriber=subscription.owner,
        owner_ids=owner_ids,
    )
    if_none_match = (request.META.get("HTTP_IF_NONE_MATCH") or "").strip()
    if if_none_match and secrets.compare_digest(if_none_match, etag):
        response = HttpResponse(status=304)
        response["ETag"] = etag
        return response
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["ETag"] = etag
    response["Cache-Control"] = "private"
    return response
