# Generated manually for data backfill

from django.db import migrations


def backfill_ingredients(apps, schema_editor):
    MealIngredient = apps.get_model("meal", "MealIngredient")
    Ingredient = apps.get_model("meal", "Ingredient")
    from meal.recipe_import import parse_ingredient_line

    for mi in MealIngredient.objects.all().iterator():
        meal = mi.meal
        owner_id = meal.owner_user_id
        label = (mi.name or "").strip()
        if not label:
            p = parse_ingredient_line(mi.raw_line or "")
            label = (p.get("name") or "").strip()
        if not label:
            label = (mi.raw_line or "").strip()[:255]
        if not label:
            continue
        existing = Ingredient.objects.filter(owner_user_id=owner_id, name__iexact=label).first()
        if existing:
            ing = existing
        else:
            ing = Ingredient.objects.create(owner_user_id=owner_id, name=label[:255])
        if mi.ingredient_id != ing.pk:
            mi.ingredient_id = ing.pk
            mi.save(update_fields=["ingredient_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("meal", "0010_ingredient_grocery_pantry"),
    ]

    operations = [
        migrations.RunPython(backfill_ingredients, noop_reverse),
    ]
