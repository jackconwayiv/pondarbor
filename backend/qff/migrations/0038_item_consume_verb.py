# Generated manually for Item.consume_verb

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0037_room_item_spawn"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="consume_verb",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Any (eat / drink / use)"),
                    ("eat", "Eat"),
                    ("drink", "Drink"),
                    ("use", "Use"),
                ],
                default="",
                help_text="Which verb must the player use to consume this? Blank = any (legacy).",
                max_length=8,
            ),
        ),
    ]
