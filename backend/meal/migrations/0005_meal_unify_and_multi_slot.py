import django.db.models.deletion
from django.db import migrations, models


def forward_backfill(apps, schema_editor):
    Meal = apps.get_model("meal", "Meal")
    MealIngredient = apps.get_model("meal", "MealIngredient")
    MealRecipe = apps.get_model("meal", "MealRecipe")
    RecipeIngredient = apps.get_model("meal", "RecipeIngredient")
    MealPlanTemplateSlot = apps.get_model("meal", "MealPlanTemplateSlot")
    MealPlanTemplateSlotMeal = apps.get_model("meal", "MealPlanTemplateSlotMeal")
    MealPlanInstanceSlot = apps.get_model("meal", "MealPlanInstanceSlot")
    MealPlanInstanceSlotMeal = apps.get_model("meal", "MealPlanInstanceSlotMeal")

    for meal in Meal.objects.all().iterator():
        links = MealRecipe.objects.filter(meal_id=meal.id).select_related("recipe").order_by("position", "id")
        directions_parts = []
        out_position = 0
        for link in links:
            recipe = link.recipe
            if recipe and recipe.directions and recipe.directions.strip():
                directions_parts.append(recipe.directions.strip())
            for ing in RecipeIngredient.objects.filter(recipe_id=link.recipe_id).order_by("position", "id"):
                MealIngredient.objects.create(
                    meal_id=meal.id,
                    position=out_position,
                    raw_line=ing.raw_line,
                    amount=ing.amount,
                    unit=ing.unit,
                    name=ing.name,
                )
                out_position += 1
        if directions_parts and not (meal.directions or "").strip():
            meal.directions = "\n\n".join(directions_parts)
            meal.save(update_fields=["directions"])

    for slot in MealPlanTemplateSlot.objects.exclude(meal_id__isnull=True).iterator():
        MealPlanTemplateSlotMeal.objects.get_or_create(slot_id=slot.id, meal_id=slot.meal_id)
    for slot in MealPlanInstanceSlot.objects.exclude(meal_id__isnull=True).iterator():
        MealPlanInstanceSlotMeal.objects.get_or_create(slot_id=slot.id, meal_id=slot.meal_id)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0004_meal_recipe_links"),
    ]

    operations = [
        migrations.AddField(
            model_name="meal",
            name="directions",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name="MealIngredient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("raw_line", models.CharField(max_length=512)),
                ("amount", models.CharField(blank=True, max_length=64)),
                ("unit", models.CharField(blank=True, max_length=64)),
                ("name", models.CharField(blank=True, max_length=255)),
                (
                    "meal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ingredients",
                        to="meal.meal",
                    ),
                ),
            ],
            options={"ordering": ["position", "id"], "unique_together": {("meal", "position")}},
        ),
        migrations.CreateModel(
            name="MealPlanTemplateSlotMeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "meal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="template_slot_links",
                        to="meal.meal",
                    ),
                ),
                (
                    "slot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="slot_meals",
                        to="meal.mealplantemplateslot",
                    ),
                ),
            ],
            options={"unique_together": {("slot", "meal")}},
        ),
        migrations.CreateModel(
            name="MealPlanInstanceSlotMeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "meal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="instance_slot_links",
                        to="meal.meal",
                    ),
                ),
                (
                    "slot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="slot_meals",
                        to="meal.mealplaninstanceslot",
                    ),
                ),
            ],
            options={"unique_together": {("slot", "meal")}},
        ),
        migrations.RunPython(forward_backfill, reverse_noop),
        migrations.RemoveField(
            model_name="mealplaninstanceslot",
            name="meal",
        ),
        migrations.RemoveField(
            model_name="mealplantemplateslot",
            name="meal",
        ),
        migrations.DeleteModel(name="MealRecipe"),
        migrations.DeleteModel(name="RecipeIngredient"),
        migrations.DeleteModel(name="Recipe"),
    ]
