from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0031_combat_stats"),
    ]

    operations = [
        migrations.AddField(
            model_name="monsterinstance",
            name="monster_strike_pending",
            field=models.BooleanField(
                default=False,
                help_text="If True, next combat tick resolves damage (wind-up already shown).",
            ),
        ),
        migrations.AddField(
            model_name="monsterinstance",
            name="xp_contribution",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="penetration",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="crit_chance_bonus_pct",
            field=models.SmallIntegerField(
                default=0,
                help_text="Percentage points added to crit chance (same as items).",
            ),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="crit_damage_bonus",
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="dodge_reduction",
            field=models.SmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="dodge_ignore",
            field=models.SmallIntegerField(default=0),
        ),
    ]
