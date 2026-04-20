from __future__ import annotations

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from calendars.models import CalendarSource
from calendars.services import LAZY_REFRESH_MAX_AGE, sync_ical_source

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Re-fetch every active iCal calendar source whose last_synced_at is older "
        "than --max-age-minutes (default 15). Intended to be run on a cron schedule."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-age-minutes",
            type=int,
            default=int(LAZY_REFRESH_MAX_AGE.total_seconds() // 60),
            help=(
                "Only sync sources whose last_synced_at is older than this many "
                "minutes (default 15)."
            ),
        )
        parser.add_argument(
            "--source-id",
            type=int,
            default=None,
            help="Sync only this source id (ignores --max-age-minutes).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Sync every active iCal source regardless of last_synced_at.",
        )

    def handle(self, *args, **options):
        source_id = options.get("source_id")
        if source_id:
            qs = CalendarSource.objects.filter(pk=source_id)
        else:
            qs = CalendarSource.objects.filter(
                is_active=True,
                source_type=CalendarSource.SourceType.ICAL,
            )
            if not options.get("force"):
                threshold = timezone.now() - timedelta(minutes=options["max_age_minutes"])
                qs = qs.filter(
                    Q(last_synced_at__isnull=True) | Q(last_synced_at__lt=threshold)
                )

        total = 0
        ok_count = 0
        not_modified_count = 0
        fail_count = 0
        for source in qs.order_by("last_synced_at"):
            total += 1
            try:
                result = sync_ical_source(source)
            except Exception:  # pragma: no cover - defensive
                logger.exception("sync_ical_source raised for source=%s", source.id)
                fail_count += 1
                continue
            if result.ok:
                ok_count += 1
                if result.not_modified:
                    not_modified_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[{source.id}] {source.display_name}: "
                        f"created={result.created} updated={result.updated} "
                        f"deleted={result.deleted} "
                        f"{'(304)' if result.not_modified else ''}"
                    )
                )
            else:
                fail_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"[{source.id}] {source.display_name}: {result.error}"
                    )
                )

        self.stdout.write(
            self.style.NOTICE(
                f"Processed {total} source(s): ok={ok_count} "
                f"(304={not_modified_count}) fail={fail_count}"
            )
        )
