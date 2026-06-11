from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0018_ingredient_food_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="display_emoji",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Optional emoji override for pantry cards; category default when empty.",
                max_length=32,
            ),
        ),
    ]
