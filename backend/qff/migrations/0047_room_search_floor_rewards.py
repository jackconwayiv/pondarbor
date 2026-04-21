# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0046_roomexit_consume_key_on_pass"),
    ]

    operations = [
        migrations.AddField(
            model_name="characterroomsearchclaim",
            name="floor_once_reward_granted",
            field=models.BooleanField(
                default=False,
                help_text="Set when search_floor_once_item was minted to the floor for this hero.",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="search_floor_once_item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rooms_search_floor_once",
                to="qff.item",
                help_text="Optional: on first successful search roll per hero, mint one unowned floor instance "
                "(once per character ever from this room).",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="search_floor_quest_item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rooms_search_floor_quest",
                to="qff.item",
                help_text="Optional: with search_floor_quest_state, mint a quest-gated floor instance on "
                "successful search when eligible (while-instance: no duplicate on floor / not carrying).",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="search_floor_quest_state",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rooms_search_floor_quest_gate",
                to="qff.queststate",
                help_text="Required with search_floor_quest_item: only heroes in this quest state receive "
                "the spawn; minted instance uses this visible quest state.",
            ),
        ),
    ]
