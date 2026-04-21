# Generated manually for service NPC flags (healer/innkeeper) and Character.pending_prompt.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0038_item_consume_verb"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="is_healer",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="npc",
            name="is_innkeeper",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="npc",
            name="healing_cost",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Gold for a heal (healer) or a night's stay (innkeeper). 0 = free.",
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="pending_prompt",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
    ]
