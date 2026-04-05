# Data migration: class blurbs live only in DB; backfill legacy rows with empty description.

from django.db import migrations


NURSE_DESC = (
    "Trained to patch wounds, read vitals, and win fights with patience "
    "and a very heavy clipboard."
)
GYM_RAT_DESC = (
    "Lives for the grind, protein math, and turning every encounter into leg day."
)


def backfill_descriptions(apps, schema_editor):
    CharacterClass = apps.get_model("qff", "CharacterClass")
    for slug, text in (("nurse", NURSE_DESC), ("gym_rat", GYM_RAT_DESC)):
        cc = CharacterClass.objects.filter(slug=slug).first()
        if cc and not (cc.description or "").strip():
            cc.description = text
            cc.save(update_fields=["description"])


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0014_remove_class_starter_head"),
    ]

    operations = [
        migrations.RunPython(backfill_descriptions, migrations.RunPython.noop),
    ]
