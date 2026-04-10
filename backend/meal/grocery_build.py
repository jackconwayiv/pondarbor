from __future__ import annotations

from django.db import transaction

from meal.models import GroceryList, GroceryListItem, MealPlanInstance


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
    slots = (
        instance.slots.prefetch_related("slot_meals__meal__ingredients")
        .order_by("day_index", "slot_index", "id")
    )
    for slot in slots:
        for slot_meal in slot.slot_meals.all():
            meal = slot_meal.meal
            for ing in meal.ingredients.all().order_by("position", "id"):
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
