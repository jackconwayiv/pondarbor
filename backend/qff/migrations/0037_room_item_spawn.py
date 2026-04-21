# Generated manually for RoomItemSpawn

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0036_alter_monsterinstance_monster_strike_pending"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomItemSpawn",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "character",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="room_item_spawns",
                        to="qff.character",
                    ),
                ),
                (
                    "item_instance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="room_item_spawn_origins",
                        to="qff.iteminstance",
                    ),
                ),
                (
                    "room_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="spawns",
                        to="qff.roomitem",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="roomitemspawn",
            index=models.Index(
                fields=["room_item", "character"],
                name="qff_roomite_room_it_7f2a91_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="roomitemspawn",
            index=models.Index(
                fields=["character", "room_item"],
                name="qff_roomite_charact_b3c4d5_idx",
            ),
        ),
    ]
