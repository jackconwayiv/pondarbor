# Generated manually for stacking, consumable extra_data, room item repeat flag.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0024_glyph_starter_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="stackable",
            field=models.BooleanField(
                default=False,
                help_text="If true, inventory merges same-template stacks up to max_stack per row.",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="max_stack",
            field=models.PositiveSmallIntegerField(
                default=99,
                help_text="Max units per ItemInstance when stackable (clamped 1–9999 in logic).",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="extra_data",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Template metadata; e.g. consume_effects list for consumable items.",
            ),
        ),
        migrations.AddField(
            model_name="iteminstance",
            name="quantity",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Stack size when item.stackable; always 1 for non-stackable templates.",
            ),
        ),
        migrations.AddField(
            model_name="roomitem",
            name="allow_repeat_while_carrying",
            field=models.BooleanField(
                default=False,
                help_text="If true, slot stays visible even when the character already carries this "
                "template (e.g. farmable pickups). Default hides while carrying.",
            ),
        ),
        migrations.AddConstraint(
            model_name="iteminstance",
            constraint=models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="qff_iteminstance_quantity_gte_1",
            ),
        ),
    ]
