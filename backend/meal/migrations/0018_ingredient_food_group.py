from django.db import migrations, models


def backfill_ingredient_food_group(apps, schema_editor):
    Ingredient = apps.get_model("meal", "Ingredient")
    UserIngredientInventory = apps.get_model("meal", "UserIngredientInventory")
    for ing in Ingredient.objects.filter(food_group="").iterator():
        for row in UserIngredientInventory.objects.filter(ingredient_id=ing.id).iterator():
            tags = row.pantry_tags if isinstance(row.pantry_tags, dict) else {}
            fg_list = tags.get("food_group")
            if not isinstance(fg_list, list) or not fg_list:
                continue
            first = str(fg_list[0]).strip()
            if not first:
                continue
            Ingredient.objects.filter(pk=ing.pk).update(food_group=first[:64])
            break


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0017_useringredientinventory_pantry_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="food_group",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Ingredient category (e.g. Meat, Vegetables); shared across pantry, meals, and grocery.",
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_ingredient_food_group, migrations.RunPython.noop),
    ]
