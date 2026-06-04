from __future__ import annotations

import time
from dataclasses import dataclass

from django.db.models import Q
from django.utils import timezone

from calendars.models import CalendarSource
from calendars.services import LAZY_REFRESH_MAX_AGE, sync_ical_source

FEED_SYNC_MAX_SOURCES = 10
FEED_SYNC_TIMEOUT_SECONDS = 10.0


@dataclass
class FeedSyncSummary:
    sources_processed: int = 0
    sources_ok: int = 0
    sources_failed: int = 0
    created: int = 0
    updated: int = 0
    deleted: int = 0
    timed_out: bool = False


def stale_ical_sources_for_owner_ids(owner_ids: list[int]):
    if not owner_ids:
        return CalendarSource.objects.none()
    threshold = timezone.now() - LAZY_REFRESH_MAX_AGE
    return (
        CalendarSource.objects.filter(
            owner_id__in=owner_ids,
            is_active=True,
            source_type=CalendarSource.SourceType.ICAL,
        )
        .filter(Q(last_synced_at__isnull=True) | Q(last_synced_at__lt=threshold))
        .order_by("last_synced_at")
    )


def sync_stale_sources_for_owner_ids(
    owner_ids: list[int],
    *,
    limit: int = FEED_SYNC_MAX_SOURCES,
    timeout_seconds: float = FEED_SYNC_TIMEOUT_SECONDS,
) -> FeedSyncSummary:
    summary = FeedSyncSummary()
    deadline = time.monotonic() + timeout_seconds
    stale_sources = list(stale_ical_sources_for_owner_ids(owner_ids)[:limit])
    for source in stale_sources:
        if time.monotonic() >= deadline:
            summary.timed_out = True
            break
        summary.sources_processed += 1
        result = sync_ical_source(source)
        if result.ok:
            summary.sources_ok += 1
            summary.created += result.created
            summary.updated += result.updated
            summary.deleted += result.deleted
        else:
            summary.sources_failed += 1
    return summary
