from __future__ import annotations

import secrets

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from calendars.feed_sync import sync_stale_sources_for_owner_ids
from calendars.ical_export import build_subscription_ics, new_subscription_token
from calendars.models import CalendarSubscription
from calendars.views import _visible_calendar_users_qs
from users.permissions import IsApprovedUser


def _feed_urls_for_request(request, token: str) -> dict[str, str]:
    path = f"/api/v1/calendars/feed/{token}.ics"
    https_url = request.build_absolute_uri(path)
    webcal_url = https_url.replace("https://", "webcal://", 1).replace(
        "http://", "webcal://", 1
    )
    return {"subscribe_url": https_url, "webcal_url": webcal_url}


def _subscription_payload(request, subscription: CalendarSubscription) -> dict:
    urls = _feed_urls_for_request(request, subscription.token)
    return {
        **urls,
        "owner_ids": subscription.owner_ids,
        "updated_at": subscription.updated_at.isoformat(),
    }


def _validate_owner_ids_for_user(request, owner_ids: list) -> tuple[list[int] | None, Response | None]:
    if not isinstance(owner_ids, list):
        return None, Response({"detail": "owner_ids must be a list of integers."}, status=400)
    parsed: list[int] = []
    for raw in owner_ids:
        if isinstance(raw, bool) or not isinstance(raw, int):
            return None, Response({"detail": "owner_ids must be a list of integers."}, status=400)
        parsed.append(raw)
    if not parsed:
        return None, Response({"detail": "Select at least one person."}, status=400)
    visible_ids = set(_visible_calendar_users_qs(request).values_list("id", flat=True))
    kept = [oid for oid in parsed if oid in visible_ids]
    if not kept:
        return None, Response({"detail": "No selected people are available."}, status=400)
    if len(kept) != len(parsed):
        return None, Response({"detail": "One or more selected people are not available."}, status=400)
    return kept, None


def _get_or_create_subscription(user) -> CalendarSubscription:
    subscription, created = CalendarSubscription.objects.get_or_create(
        owner=user,
        defaults={"token": new_subscription_token(), "owner_ids": []},
    )
    if created:
        return subscription
    return subscription


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def calendar_feed_manage(request):
    if request.method == "GET":
        subscription = CalendarSubscription.objects.filter(owner=request.user).first()
        if subscription is None:
            return Response({"detail": "No subscription yet."}, status=404)
        return Response(_subscription_payload(request, subscription))

    owner_ids = request.data.get("owner_ids")
    kept, error = _validate_owner_ids_for_user(request, owner_ids)
    if error is not None:
        return error
    subscription = _get_or_create_subscription(request.user)
    subscription.owner_ids = kept
    subscription.save(update_fields=["owner_ids", "updated_at"])
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


@api_view(["GET"])
@permission_classes([AllowAny])
def calendar_feed_ics(request, token: str):
    subscription = get_object_or_404(
        CalendarSubscription.objects.select_related("owner", "owner__profile"),
        token=token,
    )
    sync_stale_sources_for_owner_ids(subscription.owner_ids)
    body, etag = build_subscription_ics(
        subscriber=subscription.owner,
        owner_ids=subscription.owner_ids,
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
