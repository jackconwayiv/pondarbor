"""Refresh harbor catalog from seed_data (merchant-sloop shipwright purchase)."""

from django.db import migrations


def forwards(apps, schema_editor):
    from harbor.seed_data import upsert_all

    upsert_all(apps_or_none=apps)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("harbor", "0004_seed_age1_catalog"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]
