from __future__ import annotations

from django.db import transaction

from django.db.models import Prefetch

from meal.models import GroceryList, GroceryListItem, MealPlanInstance, MealRecipe


@transaction.atomic
def generate_grocery_list_for_instance(instance: MealPlanInstance) -> GroceryList:
    gl, _ = GroceryList.objects.get_or_create(
        instance=instance,
        defaults={"owner_user": instance.owner_user},
    )
    if gl.owner_user_id != instance.owner_user_id:
        gl.owner_user = instance.owner_user
        gl.save(update_fields=["owner_user", "updated_at"])
    gl.items.all().delete()
    position = 0
    meal_recipe_qs = (
        MealRecipe.objects.order_by("position", "id")
        .select_related("recipe")
        .prefetch_related("recipe__ingredients")
    )
    slots = (
        instance.slots.select_related("meal")
        .prefetch_related(Prefetch("meal__meal_recipes", queryset=meal_recipe_qs))
        .order_by("day_index", "slot_index", "id")
    )
    for slot in slots:
        meal = slot.meal
        if not meal:
            continue
        for link in meal.meal_recipes.all():
            recipe = link.recipe
            for ing in recipe.ingredients.all().order_by("position", "id"):
                text = (ing.raw_line or "").strip()
                if not text:
                    parts = [ing.amount, ing.unit, ing.name]
                    text = " ".join(p for p in parts if p).strip()
                if not text:
                    continue
                GroceryListItem.objects.create(
                    grocery_list=gl,
                    position=position,
                    display_text=text[:512],
                    quantity=ing.amount[:64] if ing.amount else "",
                    unit=ing.unit[:64] if ing.unit else "",
                    source_meal=meal,
                    manually_added=False,
                )
                position += 1
    return gl
