"""Deprecated: initial QFF world data is installed by migration 0035_reflavor_glyphs_and_classes."""

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Deprecated — use Django migrations (qff 0034) for initial QFF data."

    def handle(self, *args, **options):
        raise CommandError(
            "seed_qff is deprecated. Initial areas, classes, and glyph starter items are "
            "installed by migration qff.0035_reflavor_glyphs_and_classes. "
            "Run: python manage.py migrate"
        )
