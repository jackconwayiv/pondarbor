from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0030_monsters_lairs_combat"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="weapon_accuracy",
            field=models.SmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="item",
            name="crit_chance_bonus_pct",
            field=models.SmallIntegerField(
                default=0,
                help_text="Added as percentage points to crit chance (5 = +5%).",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="crit_damage_bonus",
            field=models.FloatField(
                default=0.0,
                help_text="Added to crit multiplier (ItemCritDamage term).",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="penetration",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="item",
            name="dodge_bonus",
            field=models.SmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="item",
            name="dodge_reduction",
            field=models.SmallIntegerField(
                default=0,
                help_text="Reduces target effective dodge when you attack.",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="dodge_ignore",
            field=models.SmallIntegerField(
                default=0,
                help_text="Further reduces target effective dodge when you attack.",
            ),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="armor",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Physical mitigation when this monster is hit.",
            ),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="accuracy",
            field=models.SmallIntegerField(
                default=0,
                help_text="WeaponAccuracy term when this monster attacks.",
            ),
        ),
    ]
