# Generated manually for RoomItem

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0020_iteminstance_visible_quest_state"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomItem",
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
                ("nickname", models.CharField(blank=True, max_length=200, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="room_item_slots",
                        to="qff.item",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="room_items",
                        to="qff.room",
                    ),
                ),
                (
                    "visible_quest_state",
                    models.ForeignKey(
                        blank=True,
                        help_text="If set, only characters in this quest state see this slot; hidden if they carry this item template; hidden if an unowned floor instance of this template exists in the room.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="room_items_visible",
                        to="qff.queststate",
                    ),
                ),
            ],
            options={
                "ordering": ["room_id", "id"],
            },
        ),
    ]
