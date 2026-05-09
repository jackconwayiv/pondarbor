"""Ensure timber-skiff voyage_nights is 2 (catalog rows seeded before the bump)."""

from django.db import migrations


def forwards(apps, schema_editor):
    HarborShipDef = apps.get_model("harbor", "HarborShipDef")
    try:
        row = HarborShipDef.objects.get(slug="timber-skiff")
    except HarborShipDef.DoesNotExist:
        return
    extra = dict(row.extra or {})
    if extra.get("voyage_nights") == 2:
        return
    extra["voyage_nights"] = 2
    row.extra = extra
    row.save(update_fields=["extra"])


def backwards(apps, schema_editor):
    HarborShipDef = apps.get_model("harbor", "HarborShipDef")
    try:
        row = HarborShipDef.objects.get(slug="timber-skiff")
    except HarborShipDef.DoesNotExist:
        return
    extra = dict(row.extra or {})
    extra["voyage_nights"] = 1
    row.extra = extra
    row.save(update_fields=["extra"])


class Migration(migrations.Migration):

    dependencies = [
        ("harbor", "0004_seed_age1_catalog"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
