from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("meal", "0015_ingredient_created_at"),
        ("users", "0015_profile_meal_slots_per_day"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="mealplaninstance",
            name="source_template",
        ),
        migrations.DeleteModel(
            name="MealPlanTemplateSlotMeal",
        ),
        migrations.DeleteModel(
            name="MealPlanTemplateSlot",
        ),
        migrations.DeleteModel(
            name="MealPlanTemplate",
        ),
    ]
