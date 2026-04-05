from django.db import migrations


class Migration(migrations.Migration):
    """Schema-only placeholder. QFF demo/world data is loaded via `manage.py seed_qff`, not migrate."""

    dependencies = [
        ("qff", "0001_initial"),
    ]

    operations = []
