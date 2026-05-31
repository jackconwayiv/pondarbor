from django.core.management.base import BaseCommand

from whatif.endgame import backfill_whatif_session_placements_from_history


class Command(BaseCommand):
    help = "Backfill WhatIfSessionPlacement rows for ended sessions (idempotent)."

    def handle(self, *args, **options):
        stats = backfill_whatif_session_placements_from_history()
        self.stdout.write(
            self.style.SUCCESS(
                "Backfill complete: "
                f"{stats['sessions_processed']} sessions processed, "
                f"{stats['placements_created']} new placement rows."
            )
        )
