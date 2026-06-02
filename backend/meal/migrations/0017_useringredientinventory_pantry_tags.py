from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0016_remove_meal_plan_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="useringredientinventory",
            name="pantry_tags",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Tag lists: food_group, storage, preferred_meal, dietary.",
            ),
        ),
    ]
