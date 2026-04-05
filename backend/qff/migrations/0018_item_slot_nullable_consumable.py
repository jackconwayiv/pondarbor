# Generated manually for Item.slot nullable + consumable

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0017_character_gold"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="consumable",
            field=models.BooleanField(
                default=False,
                help_text="If true, eat/drink/use can consume from inventory (non-consumables cannot).",
            ),
        ),
        migrations.AlterField(
            model_name="item",
            name="slot",
            field=models.CharField(
                blank=True,
                choices=[
                    ("head", "Head"),
                    ("main_hand", "Main Hand"),
                    ("off_hand", "Off-Hand"),
                    ("chest", "Chest"),
                    ("feet", "Feet"),
                    ("ring", "Ring"),
                    ("amulet", "Amulet"),
                ],
                max_length=16,
                null=True,
            ),
        ),
    ]
