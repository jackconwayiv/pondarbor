# Reverse legacy append-ordered inventory to newest-first (matches prepend semantics).

from django.db import migrations


def forwards(apps, schema_editor):
    Character = apps.get_model("qff", "Character")
    for c in Character.objects.all():
        inv = c.inventory or []
        if len(inv) > 1:
            c.inventory = list(reversed(inv))
            c.save(update_fields=["inventory", "updated_at"])


def backwards(apps, schema_editor):
    Character = apps.get_model("qff", "Character")
    for c in Character.objects.all():
        inv = c.inventory or []
        if len(inv) > 1:
            c.inventory = list(reversed(inv))
            c.save(update_fields=["inventory", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0008_roombroadcast_text_and_room_search"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
