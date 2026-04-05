from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0018_item_slot_nullable_consumable"),
    ]

    operations = [
        migrations.AddField(
            model_name="roomexit",
            name="reveal_item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="exits_revealed_by_item",
                to="qff.item",
            ),
        ),
        migrations.AddField(
            model_name="roomexit",
            name="reveal_quest_state",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="exits_revealed_by_quest_state",
                to="qff.queststate",
            ),
        ),
    ]
