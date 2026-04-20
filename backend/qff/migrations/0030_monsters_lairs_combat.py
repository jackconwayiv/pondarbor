import django.db.models.deletion
from django.db import migrations, models


def seed_sewer_rat(apps, schema_editor):
    MonsterTemplate = apps.get_model("qff", "MonsterTemplate")
    MonsterTemplate.objects.get_or_create(
        slug="sewer_rat",
        defaults={
            "name": "Sewer Rat",
            "spawn_cooldown_minutes": 5,
            "level": 1,
            "max_hp": 5,
            "damage_min": 1,
            "damage_max": 3,
            "moves": 0,
            "xp_value": 10,
            "gold_min": 0,
            "gold_max": 3,
            "loot_table": [],
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0029_npc_shops"),
    ]

    operations = [
        migrations.CreateModel(
            name="MonsterTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("spawn_cooldown_minutes", models.PositiveSmallIntegerField(default=5)),
                ("level", models.PositiveSmallIntegerField(default=1)),
                ("max_hp", models.PositiveSmallIntegerField(default=5)),
                ("damage_min", models.PositiveSmallIntegerField(default=1)),
                ("damage_max", models.PositiveSmallIntegerField(default=3)),
                (
                    "moves",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="Added to d100 for initiative (0 if not set).",
                    ),
                ),
                ("xp_value", models.PositiveIntegerField(default=5)),
                ("gold_min", models.PositiveIntegerField(default=0)),
                ("gold_max", models.PositiveIntegerField(default=3)),
                ("loot_table", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="MonsterInstance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("pursuit_path", models.JSONField(blank=True, default=list)),
                ("cur_hp", models.PositiveSmallIntegerField(default=1)),
                ("max_hp", models.PositiveSmallIntegerField(default=1)),
                ("next_action_at", models.DateTimeField(blank=True, null=True)),
                ("next_pursuit_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "current_room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="monster_instances",
                        to="qff.room",
                    ),
                ),
                (
                    "engaged_character",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monsters_engaged",
                        to="qff.character",
                    ),
                ),
                (
                    "lair_room",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="lair_spawned_instances",
                        to="qff.room",
                    ),
                ),
                (
                    "pursuit_target_character",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monsters_pursuing",
                        to="qff.character",
                    ),
                ),
                (
                    "template",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="instances",
                        to="qff.monstertemplate",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="RoomGoldPile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_remaining", models.PositiveIntegerField()),
                ("label", models.CharField(blank=True, max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gold_piles",
                        to="qff.room",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.AddField(
            model_name="room",
            name="is_safe",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="room",
            name="is_spawn_point",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="room",
            name="lair_next_spawn_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="room",
            name="lair_last_instance",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="remembered_by_lairs",
                to="qff.monsterinstance",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="monster_lair_template",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="lair_rooms",
                to="qff.monstertemplate",
            ),
        ),
        migrations.AddIndex(
            model_name="monsterinstance",
            index=models.Index(fields=["current_room"], name="qff_monster_current_0f3f91_idx"),
        ),
        migrations.AddIndex(
            model_name="monsterinstance",
            index=models.Index(fields=["next_action_at"], name="qff_monster_next_ac_8b4f2c_idx"),
        ),
        migrations.AddIndex(
            model_name="monsterinstance",
            index=models.Index(fields=["next_pursuit_at"], name="qff_monster_next_pu_7a1d8e_idx"),
        ),
        migrations.AddField(
            model_name="character",
            name="combat_target_monster",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="targeted_by_heroes",
                to="qff.monsterinstance",
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="died_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="character",
            name="is_dead",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="last_command_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="character",
            name="next_action_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="character",
            name="unspent_stat_points",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="npc",
            name="is_trainer",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="roombroadcast",
            name="speaker",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="room_broadcasts_sent",
                to="qff.character",
            ),
        ),
        migrations.AddField(
            model_name="roombroadcast",
            name="target_character",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="room_broadcasts_targeted",
                to="qff.character",
            ),
        ),
        migrations.RunPython(seed_sewer_rat, migrations.RunPython.noop),
    ]
