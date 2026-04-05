from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0019_roomexit_reveal_visibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="iteminstance",
            name="visible_quest_state",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="floor_item_instances_visible",
                help_text="If set, only characters in this quest state see this floor item; hidden if they already carry this item template.",
                to="qff.queststate",
            ),
        ),
    ]
