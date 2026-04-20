from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from typing import Iterable

import requests
from django.db import transaction
from django.utils import timezone

from calendars.models import CalendarSource, Event

logger = logging.getLogger(__name__)

# Hard caps to protect the server from hostile or very large iCal feeds.
ICAL_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
ICAL_MAX_EVENTS = 5_000
ICAL_FETCH_TIMEOUT_SECONDS = 10.0
ICAL_USER_AGENT = "PondArbor-Calendar-Sync/1.0"

# Lazy refresh window: treat a source as "fresh" if synced this recently.
LAZY_REFRESH_MAX_AGE = timedelta(minutes=15)


@dataclass
class SyncResult:
    ok: bool
    not_modified: bool = False
    created: int = 0
    updated: int = 0
    deleted: int = 0
    error: str = ""


class IcalFetchError(Exception):
    pass


class IcalParseError(Exception):
    pass


# ---------------------------------------------------------------------------
# ICS parsing
# ---------------------------------------------------------------------------

# Minimal line unfolding + VEVENT parser. We avoid introducing a new runtime
# dep for v1; ICS is a simple line-based format and we only need a handful of
# properties. If the format variability grows, swap in `icalendar`.
_LINE_CONTINUATION_RE = re.compile(r"\r?\n[ \t]")


def _unfold(text: str) -> str:
    return _LINE_CONTINUATION_RE.sub("", text)


def _split_prop(raw_line: str) -> tuple[str, dict[str, str], str]:
    """Return ``(name, params, value)`` for a single content line."""
    # Split name/params from value on the first unquoted ':'
    in_quotes = False
    colon_idx = -1
    for idx, ch in enumerate(raw_line):
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ":" and not in_quotes:
            colon_idx = idx
            break
    if colon_idx < 0:
        return raw_line.upper(), {}, ""
    prefix = raw_line[:colon_idx]
    value = raw_line[colon_idx + 1 :]
    parts = prefix.split(";")
    name = parts[0].strip().upper()
    params: dict[str, str] = {}
    for p in parts[1:]:
        if "=" not in p:
            continue
        k, v = p.split("=", 1)
        params[k.strip().upper()] = v.strip().strip('"')
    return name, params, value


def _parse_ics_datetime(raw: str, params: dict[str, str]) -> tuple[datetime, bool, str]:
    """Parse an ICS DTSTART/DTEND/etc value.

    Returns ``(dt, all_day, source_tz)`` where ``dt`` is an aware UTC datetime.
    For ``VALUE=DATE``, the returned datetime is midnight UTC of that day and
    ``all_day`` is True.
    """
    value = (raw or "").strip()
    is_date_only = params.get("VALUE", "").upper() == "DATE" or (
        len(value) == 8 and value.isdigit()
    )
    tzid = params.get("TZID", "")

    if is_date_only:
        if len(value) != 8 or not value.isdigit():
            raise IcalParseError(f"Invalid DATE value: {value!r}")
        year = int(value[0:4])
        month = int(value[4:6])
        day = int(value[6:8])
        dt = datetime.combine(date(year, month, day), time(0, 0, 0), tzinfo=dt_timezone.utc)
        return dt, True, tzid

    # DATE-TIME forms: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    match = re.fullmatch(
        r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)", value
    )
    if not match:
        raise IcalParseError(f"Invalid DATE-TIME value: {value!r}")
    year, month, day, hh, mm, ss, z = match.groups()
    naive = datetime(int(year), int(month), int(day), int(hh), int(mm), int(ss))
    if z == "Z":
        aware = naive.replace(tzinfo=dt_timezone.utc)
    elif tzid:
        try:
            import zoneinfo

            tz = zoneinfo.ZoneInfo(tzid)
            aware = naive.replace(tzinfo=tz).astimezone(dt_timezone.utc)
        except Exception:
            # Unknown tzid: fall back to treating as UTC (best-effort).
            aware = naive.replace(tzinfo=dt_timezone.utc)
    else:
        # Floating time: treat as UTC. Better than guessing server TZ.
        aware = naive.replace(tzinfo=dt_timezone.utc)
    return aware, False, tzid


def _unescape_text(value: str) -> str:
    # ICS text escapes per RFC 5545 § 3.3.11
    return (
        value.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )


@dataclass
class ParsedEvent:
    uid: str
    title: str
    location: str
    notes: str
    start_at: datetime
    end_at: datetime
    all_day: bool
    source_timezone: str


def parse_ics(text: str) -> list[ParsedEvent]:
    unfolded = _unfold(text)
    lines = unfolded.splitlines()
    events: list[ParsedEvent] = []
    in_event = False
    current: dict = {}

    for line in lines:
        if not line:
            continue
        stripped = line.strip()
        if stripped.upper() == "BEGIN:VEVENT":
            in_event = True
            current = {}
            continue
        if stripped.upper() == "END:VEVENT":
            if in_event:
                parsed = _finalize_event(current)
                if parsed is not None:
                    events.append(parsed)
                if len(events) >= ICAL_MAX_EVENTS:
                    break
            in_event = False
            current = {}
            continue
        if not in_event:
            continue
        name, params, value = _split_prop(stripped)
        if name in ("DTSTART", "DTEND"):
            dt, all_day, tzid = _parse_ics_datetime(value, params)
            current[name] = dt
            current[f"{name}__ALL_DAY"] = all_day
            current[f"{name}__TZID"] = tzid
        elif name == "DURATION":
            current["DURATION"] = value
        elif name == "UID":
            current["UID"] = value.strip()
        elif name == "SUMMARY":
            current["SUMMARY"] = _unescape_text(value)
        elif name == "LOCATION":
            current["LOCATION"] = _unescape_text(value)
        elif name == "DESCRIPTION":
            current["DESCRIPTION"] = _unescape_text(value)

    return events


def _finalize_event(current: dict) -> ParsedEvent | None:
    dtstart = current.get("DTSTART")
    if dtstart is None:
        return None
    dtend = current.get("DTEND")
    all_day = bool(current.get("DTSTART__ALL_DAY"))
    if dtend is None:
        # Fall back to DURATION if present, otherwise assume all-day or zero-length.
        if all_day:
            dtend = dtstart + timedelta(days=1)
        else:
            dtend = dtstart
    if dtend < dtstart:
        dtend = dtstart
    uid = (current.get("UID") or "").strip()
    title = (current.get("SUMMARY") or "").strip() or "(Untitled event)"
    return ParsedEvent(
        uid=uid[:500],
        title=title[:500],
        location=(current.get("LOCATION") or "")[:500],
        notes=current.get("DESCRIPTION") or "",
        start_at=dtstart,
        end_at=dtend,
        all_day=all_day,
        source_timezone=(
            current.get("DTSTART__TZID") or current.get("DTEND__TZID") or ""
        )[:64],
    )


# ---------------------------------------------------------------------------
# Fetching + syncing
# ---------------------------------------------------------------------------


def _fetch_ical(url: str, *, etag: str, last_modified: str) -> tuple[int, str, dict[str, str]]:
    headers = {"User-Agent": ICAL_USER_AGENT}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=ICAL_FETCH_TIMEOUT_SECONDS,
            stream=True,
        )
    except requests.RequestException as exc:
        raise IcalFetchError(str(exc)) from exc
    if response.status_code == 304:
        return 304, "", dict(response.headers)
    if response.status_code != 200:
        raise IcalFetchError(
            f"Unexpected status {response.status_code} from iCal feed."
        )
    # Enforce max body size while streaming.
    buf = bytearray()
    try:
        for chunk in response.iter_content(chunk_size=65536):
            if not chunk:
                continue
            buf.extend(chunk)
            if len(buf) > ICAL_MAX_BYTES:
                raise IcalFetchError(
                    f"iCal feed exceeds {ICAL_MAX_BYTES} byte cap."
                )
    finally:
        response.close()
    try:
        text = buf.decode("utf-8", errors="replace")
    except Exception as exc:  # pragma: no cover - decode error paths
        raise IcalParseError(f"Could not decode iCal body: {exc}") from exc
    return 200, text, dict(response.headers)


@transaction.atomic
def _apply_events(source: CalendarSource, parsed: Iterable[ParsedEvent]) -> tuple[int, int, int]:
    parsed_list = list(parsed)
    by_uid = {
        p.uid: p
        for p in parsed_list
        if p.uid  # Ignore feed entries without UIDs (rare); we can't dedupe them.
    }
    existing = list(
        source.events.all().only("id", "external_uid")
    )
    existing_by_uid = {ev.external_uid: ev for ev in existing if ev.external_uid}

    created = 0
    updated = 0
    for uid, p in by_uid.items():
        existing_event = existing_by_uid.get(uid)
        if existing_event is None:
            Event.objects.create(
                owner=source.owner,
                source=source,
                external_uid=uid,
                title=p.title,
                location=p.location,
                notes=p.notes,
                start_at=p.start_at,
                end_at=p.end_at,
                all_day=p.all_day,
                source_timezone=p.source_timezone,
            )
            created += 1
        else:
            changed_fields: list[str] = []

            def _maybe_set(field: str, value) -> None:
                if getattr(existing_event, field) != value:
                    setattr(existing_event, field, value)
                    changed_fields.append(field)

            _maybe_set("title", p.title)
            _maybe_set("location", p.location)
            _maybe_set("notes", p.notes)
            _maybe_set("start_at", p.start_at)
            _maybe_set("end_at", p.end_at)
            _maybe_set("all_day", p.all_day)
            _maybe_set("source_timezone", p.source_timezone)
            if changed_fields:
                existing_event.save(update_fields=changed_fields + ["updated_at"])
                updated += 1

    # Delete events whose UIDs disappeared from the feed.
    stale_ids = [
        ev.id for ev in existing if ev.external_uid and ev.external_uid not in by_uid
    ]
    deleted = 0
    if stale_ids:
        deleted, _ = Event.objects.filter(pk__in=stale_ids).delete()
    return created, updated, deleted


def sync_ical_source(source: CalendarSource) -> SyncResult:
    """Pull the latest events for a single iCal source."""
    if source.source_type != CalendarSource.SourceType.ICAL:
        return SyncResult(ok=False, error="Only iCal sources can be synced.")
    if not source.ical_url:
        return SyncResult(ok=False, error="Source has no iCal URL.")

    try:
        status_code, body, response_headers = _fetch_ical(
            source.ical_url,
            etag=source.last_etag,
            last_modified=source.last_modified_header,
        )
    except IcalFetchError as exc:
        source.last_error = str(exc)[:500]
        source.save(update_fields=["last_error", "updated_at"])
        return SyncResult(ok=False, error=str(exc))

    if status_code == 304:
        source.last_synced_at = timezone.now()
        source.last_error = ""
        source.save(update_fields=["last_synced_at", "last_error", "updated_at"])
        return SyncResult(ok=True, not_modified=True)

    try:
        parsed = parse_ics(body)
    except IcalParseError as exc:
        source.last_error = f"Parse error: {exc}"[:500]
        source.save(update_fields=["last_error", "updated_at"])
        return SyncResult(ok=False, error=str(exc))

    created, updated, deleted = _apply_events(source, parsed)

    source.last_synced_at = timezone.now()
    source.last_etag = (response_headers.get("ETag") or "")[:255]
    source.last_modified_header = (response_headers.get("Last-Modified") or "")[:255]
    source.last_error = ""
    source.save(
        update_fields=[
            "last_synced_at",
            "last_etag",
            "last_modified_header",
            "last_error",
            "updated_at",
        ]
    )
    return SyncResult(ok=True, created=created, updated=updated, deleted=deleted)


def sources_due_for_sync(*, now=None, max_age: timedelta = LAZY_REFRESH_MAX_AGE):
    """Return iCal sources that have not been synced recently."""
    now = now or timezone.now()
    threshold = now - max_age
    return CalendarSource.objects.filter(
        is_active=True,
        source_type=CalendarSource.SourceType.ICAL,
    ).filter(models_due_q(threshold))


def models_due_q(threshold):
    from django.db.models import Q

    return Q(last_synced_at__isnull=True) | Q(last_synced_at__lt=threshold)


def ensure_manual_source(user) -> CalendarSource:
    """Return the (single) manual source for the user, creating it on first use."""
    source, _ = CalendarSource.objects.get_or_create(
        owner=user,
        source_type=CalendarSource.SourceType.MANUAL,
        defaults={
            "display_name": "Manual events",
            "color": CalendarSource.Color.LILYPAD,
            "is_active": True,
        },
    )
    return source
