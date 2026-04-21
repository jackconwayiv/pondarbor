# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0043_monster_lore_dc_weapon_loot"),
    ]

    operations = [
        migrations.AddField(
            model_name="roomitem",
            name="mint_policy",
            field=models.CharField(
                choices=[
                    ("while_instance", "Once if item no longer exists (per hero)"),
                    ("once_ever", "Once per character (never again from this slot)"),
                ],
                default="while_instance",
                help_text="while_instance: hide while this hero's minted instance still exists. once_ever: hide forever after this hero's first successful get from this slot.",
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="RoomItemCharacterClaim",
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
                        related_name="room_item_character_claims",
                        to="qff.character",
                    ),
                ),
                (
                    "room_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="character_claims",
                        to="qff.roomitem",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="roomitemcharacterclaim",
            index=models.Index(
                fields=["room_item", "character"],
                name="qff_roomitemclaim_room_ch_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="roomitemcharacterclaim",
            constraint=models.UniqueConstraint(
                fields=("room_item", "character"),
                name="qff_roomitemcharacterclaim_unique_slot_hero",
            ),
        ),
    ]
