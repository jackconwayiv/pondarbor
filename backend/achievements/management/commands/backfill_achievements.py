from django.core.management.base import BaseCommand

from achievements.services import backfill_all_achievements


class Command(BaseCommand):
    help = "Grant achievement unlocks for users who already meet the rules (idempotent)."

    def handle(self, *args, **options):
        backfill_all_achievements()
        self.stdout.write(self.style.SUCCESS("Backfill complete."))
