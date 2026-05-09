"""Merge conflicting leaf migrations (shipwright seed vs timber-skiff→0006 branch)."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("harbor", "0005_shipwright_hull_purchase_seed"),
        ("harbor", "0006_ship_upgrade_and_stage_unlocks"),
    ]

    operations = []
