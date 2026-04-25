"""Seed starter Harbormaster catalog content on initial migrate."""

from django.db import migrations


def seed_forwards(apps, _schema_editor):
    from harbor.seed_data import upsert_all

    upsert_all(apps_or_none=apps)


def seed_reverse(_apps, _schema_editor):
    # Reversal would delete content the player relies on; treat as no-op.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("harbor", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_forwards, seed_reverse),
    ]
