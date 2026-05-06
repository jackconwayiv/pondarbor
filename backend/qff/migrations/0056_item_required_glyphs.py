from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0055_character_glyph_levels"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="required_glyphs",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Up to two required glyphs for equip/use; empty means no glyph gate.",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="required_glyphs_mode",
            field=models.CharField(
                choices=[("and", "All required (AND)"), ("or", "Any required (OR)")],
                default="and",
                help_text="How to evaluate two required glyphs: AND (both) or OR (either).",
                max_length=8,
            ),
        ),
    ]
