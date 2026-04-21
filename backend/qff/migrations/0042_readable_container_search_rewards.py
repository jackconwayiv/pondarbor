# Readable/container interactable kinds, opened container, search rewards, monster lore roll threshold.

import django.db.models.deletion
from django.db import migrations, models


def forwards_interactable_kinds(apps, schema_editor):
    Interactable = apps.get_model("qff", "Interactable")
    Interactable.objects.filter(kind__in=["sign", "tome"]).update(kind="readable")
    Interactable.objects.filter(kind__in=["chest", "barrel", "crate", "sack"]).update(
        kind="container"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0041_interactable_unlocks_exit_secondary"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="opened_container_interactable",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="characters_with_opened_container",
                to="qff.interactable",
            ),
        ),
        migrations.AddField(
            model_name="interactable",
            name="untranslated",
            field=models.BooleanField(
                default=False,
                help_text="If true, heroes without the 👽 glyph see only the alien-language block message.",
            ),
        ),
        migrations.AddField(
            model_name="monstertemplate",
            name="hidden_description_chance",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Sense roll threshold (1–100) for extra monster text; null defaults to 50.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="search_reward_item",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional: on first successful search roll per hero, mint one into inventory.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rooms_search_reward",
                to="qff.item",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="search_reveals_exit",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional: on first successful search roll per hero, grant CharacterExitSeen for this exit.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rooms_search_reveal_exit",
                to="qff.roomexit",
            ),
        ),
        migrations.CreateModel(
            name="CharacterRoomSearchClaim",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_reward_granted", models.BooleanField(default=False)),
                ("exit_reward_granted", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "character",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="room_search_claims",
                        to="qff.character",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="search_claims",
                        to="qff.room",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("character", "room"),
                        name="qff_charroomsearchclaim_uniq",
                    )
                ],
            },
        ),
        migrations.RunPython(forwards_interactable_kinds, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="interactable",
            name="kind",
            field=models.CharField(
                choices=[
                    ("readable", "Readable"),
                    ("container", "Container"),
                    ("button", "Button"),
                    ("lever", "Lever"),
                    ("switch", "Switch"),
                    ("pulley", "Pulley"),
                    ("sconce", "Sconce"),
                    ("map", "Map"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="item",
            name="consume_verb",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Any (eat / drink / use / read)"),
                    ("eat", "Eat"),
                    ("drink", "Drink"),
                    ("use", "Use"),
                    ("read", "Read"),
                ],
                default="",
                help_text="Which verb must the player use to consume this? Blank = any (legacy).",
                max_length=8,
            ),
        ),
    ]
