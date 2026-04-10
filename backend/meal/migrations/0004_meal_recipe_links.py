import django.db.models.deletion
from django.db import migrations, models


def copy_meal_recipes(apps, schema_editor):
    Meal = apps.get_model("meal", "Meal")
    MealRecipe = apps.get_model("meal", "MealRecipe")
    for meal in Meal.objects.exclude(recipe_id__isnull=True).iterator():
        MealRecipe.objects.get_or_create(
            meal_id=meal.id,
            recipe_id=meal.recipe_id,
            defaults={"position": 0},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0003_meal_title"),
    ]

    operations = [
        migrations.CreateModel(
            name="MealRecipe",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveSmallIntegerField(default=0)),
                (
                    "meal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="meal_recipes",
                        to="meal.meal",
                    ),
                ),
                (
                    "recipe",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="meal_links",
                        to="meal.recipe",
                    ),
                ),
            ],
            options={
                "ordering": ["position", "id"],
                "unique_together": {("meal", "recipe")},
            },
        ),
        migrations.RunPython(copy_meal_recipes, noop_reverse),
        migrations.RemoveField(
            model_name="meal",
            name="recipe",
        ),
    ]
