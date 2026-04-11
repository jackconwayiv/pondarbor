from __future__ import annotations

from collections import defaultdict

from django.db import transaction
from django.db.models import Prefetch

from meal.grocery_amounts import build_merged_grocery_display_text
from meal.ingredients import label_for_ingredient_row
from meal.models import (
    GroceryList,
    GroceryListItem,
    Ingredient,
    MealIngredient,
    MealPlanInstance,
    MealPlanInstanceSlotMeal,
)


def _display_line_from_meal_ingredient(ing) -> str:
    text = (ing.raw_line or "").strip()
    if not text:
        parts = [ing.amount, ing.unit, ing.name]
        text = " ".join(p for p in parts if p).strip()
    return text[:512]


@transaction.atomic
def generate_grocery_list_for_instance(instance: MealPlanInstance) -> GroceryList:
    gl, _ = GroceryList.objects.get_or_create(
        instance=instance,
        defaults={"owner_user": instance.owner_user},
    )
    if gl.owner_user_id != instance.owner_user_id:
        gl.owner_user = instance.owner_user
        gl.save(update_fields=["owner_user", "updated_at"])

    manual = list(gl.items.filter(manually_added=True).order_by("position", "id"))
    gl.items.filter(manually_added=False).delete()

    groups: dict[tuple, list[dict]] = defaultdict(list)

    slots = (
        instance.slots.prefetch_related(
            Prefetch(
                "slot_meals",
                queryset=MealPlanInstanceSlotMeal.objects.select_related("meal").prefetch_related(
                    Prefetch(
                        "meal__ingredients",
                        queryset=MealIngredient.objects.select_related("ingredient").order_by("position", "id"),
                    ),
                ),
            ),
        )
        .order_by("day_index", "slot_index", "id")
    )

    for slot in slots:
        for sm in slot.slot_meals.all():
            meal = sm.meal
            title = (meal.title or "").strip() or "Recipe"
            for ing in meal.ingredients.all().order_by("position", "id"):
                text = _display_line_from_meal_ingredient(ing)
                if not text:
                    continue
                if ing.ingredient_id:
                    key = ("i", ing.ingredient_id)
                else:
                    lab = label_for_ingredient_row(
                        raw_line=ing.raw_line,
                        amount=ing.amount,
                        unit=ing.unit,
                        name=ing.name,
                    ).lower()
                    key = ("t", lab or text.lower()[:200])
                qty = (ing.amount or "")[:64]
                unit = (ing.unit or "")[:64]
                groups[key].append(
                    {
                        "meal_id": meal.id,
                        "meal_title": title[:255],
                        "display": text,
                        "quantity": qty,
                        "unit": unit,
                        "raw_line": (ing.raw_line or "")[:512],
                        "name": (ing.name or "")[:255],
                    },
                )

    ing_ids = [k[1] for k in groups if k[0] == "i"]
    ing_by_id = {i.id: i for i in Ingredient.objects.filter(pk__in=ing_ids)}

    def sort_key(k: tuple) -> tuple:
        if k[0] == "i":
            ing = ing_by_id.get(k[1])
            return (0, (ing.name if ing else "").lower(), k[1])
        return (1, k[1], 0)

    sorted_keys = sorted(groups.keys(), key=sort_key)

    position = 0
    for key in sorted_keys:
        contribs = groups[key]
        if not contribs:
            continue
        n = len(contribs)
        ing_obj = ing_by_id.get(key[1]) if key[0] == "i" else None
        display_text = build_merged_grocery_display_text(n=n, ing_obj=ing_obj, contribs=contribs)
        source_meal_id = contribs[0]["meal_id"] if n == 1 else None

        GroceryListItem.objects.create(
            grocery_list=gl,
            position=position,
            display_text=display_text,
            quantity="",
            unit="",
            source_meal_id=source_meal_id,
            manually_added=False,
            ingredient=ing_obj,
            is_checked=False,
            contributions=contribs,
        )
        position += 1

    for i, item in enumerate(manual):
        item.position = position + i
        item.save(update_fields=["position"])

    return gl
