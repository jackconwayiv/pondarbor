from __future__ import annotations

import hashlib
import secrets
from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db.models import Q

from calendars.models import Event
from calendars.serializers import _owner_row
from users.social_privacy import published_owner_visibility_q, viewer_context

User = get_user_model()

CALENDAR_NAME = "Friends Away"
FEED_PAST_DAYS = 30
FEED_FUTURE_DAYS = 366
UID_DOMAIN = "pondarbor"


def new_subscription_token() -> str:
    return secrets.token_urlsafe(32)


def _display_name_for_user(user) -> str:
    return _owner_row(user)["display_name"]


def _feed_date_window(*, today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    start = today - timedelta(days=FEED_PAST_DAYS)
    end = today + timedelta(days=FEED_FUTURE_DAYS)
    return start, end


def events_for_subscription(
    *,
    subscriber,
    owner_ids: list[int],
    start_date: date | None = None,
    end_date: date | None = None,
):
    if not owner_ids:
        return Event.objects.none()
    window_start, window_end = _feed_date_window()
    start_date = start_date or window_start
    end_date = end_date or window_end
    approved_ids = set(
        User.objects.filter(
            account_status=User.AccountStatus.APPROVED,
            deleted_at__isnull=True,
            pk__in=owner_ids,
        ).values_list("id", flat=True)
    )
    kept = [oid for oid in owner_ids if oid in approved_ids]
    if not kept:
        return Event.objects.none()
    ctx = viewer_context(viewer=subscriber)
    return (
        Event.objects.select_related("owner", "owner__profile")
        .filter(owner_id__in=kept)
        .filter(start_date__lte=end_date, end_date__gte=start_date)
        .filter(published_owner_visibility_q(viewer=subscriber, owner_fk_field="owner", ctx=ctx))
        .order_by("start_date", "id")
    )


def _names_by_day_from_events(events) -> dict[date, set[str]]:
    by_day: dict[date, set[str]] = {}
    for event in events:
        name = _display_name_for_user(event.owner)
        day = event.start_date
        while day <= event.end_date:
            by_day.setdefault(day, set()).add(name)
            day += timedelta(days=1)
    return by_day


def _coalesce_busy_ranges(
    names_by_day: dict[date, set[str]],
) -> list[tuple[date, date, tuple[str, ...]]]:
    if not names_by_day:
        return []
    ranges: list[tuple[date, date, tuple[str, ...]]] = []
    for day in sorted(names_by_day):
        names = tuple(sorted(names_by_day[day]))
        if ranges:
            prev_start, prev_end, prev_names = ranges[-1]
            if prev_names == names and (day - prev_end) == timedelta(days=1):
                ranges[-1] = (prev_start, day, prev_names)
                continue
        ranges.append((day, day, names))
    return ranges


def _ics_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _format_ics_date(value: date) -> str:
    return value.strftime("%Y%m%d")


def _event_uid(start: date, end: date, names: tuple[str, ...]) -> str:
    payload = f"{start.isoformat()}:{end.isoformat()}:{','.join(names)}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]
    return f"pondarbor-busy-{digest}@{UID_DOMAIN}"


def build_subscription_ics(*, subscriber, owner_ids: list[int]) -> tuple[str, str]:
    """Return ``(ics_body, etag)`` for a subscription feed."""
    events = list(events_for_subscription(subscriber=subscriber, owner_ids=owner_ids))
    names_by_day = _names_by_day_from_events(events)
    ranges = _coalesce_busy_ranges(names_by_day)
    now_stamp = datetime.now(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PondArbor//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_escape(CALENDAR_NAME)}",
    ]
    for start, end, names in ranges:
        summary = ", ".join(names)
        uid = _event_uid(start, end, names)
        # RFC 5545 all-day DTEND is exclusive.
        dtend = end + timedelta(days=1)
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART;VALUE=DATE:{_format_ics_date(start)}",
                f"DTEND;VALUE=DATE:{_format_ics_date(dtend)}",
                f"SUMMARY:{_ics_escape(summary)}",
                "TRANSP:OPAQUE",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    body = "\r\n".join(lines) + "\r\n"
    etag = f'"{hashlib.sha256(body.encode("utf-8")).hexdigest()}"'
    return body, etag
