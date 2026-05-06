from django.db import migrations, models


def backfill_glyph_levels(apps, schema_editor):
    Character = apps.get_model("qff", "Character")
    for ch in Character.objects.all().only("id", "level", "glyphs"):
        glyphs = list(ch.glyphs or [])
        if not glyphs:
            levels = []
        elif len(glyphs) == 1:
            levels = [int(ch.level or 1)]
        else:
            # Backfill choice: existing multi-glyph heroes keep all progress in glyph 1.
            levels = [int(ch.level or 1)] + [0] * (len(glyphs) - 1)
        Character.objects.filter(pk=ch.pk).update(glyph_levels=levels)


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0054_help_text_sync"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="glyph_levels",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Per-glyph level values aligned with glyphs order. Invariant: sum(glyph_levels) == character.level for characters with glyphs.",
            ),
        ),
        migrations.RunPython(backfill_glyph_levels, migrations.RunPython.noop),
    ]
