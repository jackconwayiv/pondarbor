"""Seed Harbormaster catalog content.

Idempotent: run as many times as you like; existing rows are updated by slug.
"""

from django.core.management.base import BaseCommand

from harbor.seed_data import upsert_all


class Command(BaseCommand):
    help = "Upsert Harbormaster starter catalog content (ships, buildings, operations, ...)."

    def handle(self, *args, **options):
        summary = upsert_all()
        for def_type, counts in summary.items():
            self.stdout.write(
                f"  {def_type:>14}: created={counts['created']} updated={counts['updated']}"
            )
        self.stdout.write(self.style.SUCCESS("Harbor catalog seed complete."))
