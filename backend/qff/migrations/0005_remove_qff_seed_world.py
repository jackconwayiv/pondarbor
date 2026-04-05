from django.db import migrations


class Migration(migrations.Migration):
    """Placeholder: seed removal and demo data are not handled by migrate.

    Use Django admin / DM tools, or (dev/staging) `manage.py seed_qff` to load demo data.
    """

    dependencies = [
        ("qff", "0004_character_spawn_room"),
    ]

    operations = []
