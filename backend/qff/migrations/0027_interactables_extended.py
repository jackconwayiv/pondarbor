import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0026_dark_minimap_lighting"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="hero_permanent_minimap_lit_room_ids",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="character",
            name="minimap_full_reveal_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="character",
            name="minimap_full_reveal_area",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="characters_map_reveal",
                to="qff.area",
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="container_focus_interactable",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="characters_with_focus",
                to="qff.interactable",
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="container_focus_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="iteminstance",
            name="container_interactable",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="container_items",
                to="qff.interactable",
            ),
        ),
        migrations.AddField(
            model_name="roomitem",
            name="interactable",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="container_room_items",
                to="qff.interactable",
            ),
        ),
        migrations.AddField(
            model_name="questtransition",
            name="revert_after_minutes",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="If set, character quest state reverts after this many minutes (silent rewind).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="questtransition",
            name="revert_to_state",
            field=models.ForeignKey(
                blank=True,
                help_text="State to revert to; defaults to from_state when null.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="transitions_revert_to",
                to="qff.queststate",
            ),
        ),
        migrations.AddField(
            model_name="characterquestprogress",
            name="quest_revert_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="characterquestprogress",
            name="quest_revert_to_state",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="quest_progress_pending_revert",
                to="qff.queststate",
            ),
        ),
        migrations.AddField(
            model_name="interactable",
            name="read_text",
            field=models.TextField(
                blank=True,
                help_text="Long text for read/tome; falls back to inspect_text when empty.",
            ),
        ),
        migrations.AddField(
            model_name="interactable",
            name="map_reveal_minutes",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="For kind=map: duration of full visited-map reveal in this area.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="interactable",
            name="kind",
            field=models.CharField(
                choices=[
                    ("sign", "Sign"),
                    ("tome", "Tome"),
                    ("chest", "Chest"),
                    ("barrel", "Barrel"),
                    ("crate", "Crate"),
                    ("sack", "Sack"),
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
        migrations.AddIndex(
            model_name="iteminstance",
            index=models.Index(
                fields=["container_interactable", "room"],
                name="qff_iteminst_container_room_idx",
            ),
        ),
    ]
