"""Upsert Age 1 ships/buildings and bump catalog from seed_data."""

from django.db import migrations


def forwards(apps, schema_editor):
    from harbor.seed_data import upsert_all

    upsert_all(apps_or_none=apps)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("harbor", "0003_harbor_game_multi"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]
