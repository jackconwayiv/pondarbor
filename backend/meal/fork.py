"""Clone partner-owned meals referenced by slots/grocery on disconnect."""

from __future__ import annotations

from collections.abc import Iterable

from django.contrib.auth import get_user_model
from django.db import transaction

from meal.models import (
    GroceryListItem,
    Meal,
    MealIngredient,
    MealPlanInstanceSlotMeal,
    MealPlanTemplateSlotMeal,
)

User = get_user_model()


def _clone_meal_for_user(*, meal: Meal, new_owner) -> Meal:
    new_meal = Meal.objects.create(
        owner_user=new_owner,
        title=meal.title,
        blurb=meal.blurb,
        directions=meal.directions,
        cloned_from_meal=meal,
    )
    for ing in meal.ingredients.all().order_by("position", "id"):
        MealIngredient.objects.create(
            meal=new_meal,
            position=ing.position,
            raw_line=ing.raw_line,
            amount=ing.amount,
            unit=ing.unit,
            name=ing.name,
        )
    return new_meal


def fork_partner_meals_for_user(*, owner: User, partner: User) -> None:
    """
    For every partner-owned Meal referenced from owner-owned slots or grocery rows,
    clone into owner's account (dedupe recipes) and rewrite references.
    """
    partner_id = partner.id
    meal_map: dict[int, Meal] = {}

    def get_clone(m: Meal) -> Meal:
        if m.id in meal_map:
            return meal_map[m.id]
        if m.owner_user_id != partner_id:
            return m
        cloned = _clone_meal_for_user(meal=m, new_owner=owner)
        meal_map[m.id] = cloned
        return cloned

    # Template slot meal links
    for slot_meal in MealPlanTemplateSlotMeal.objects.filter(
        slot__template__owner_user=owner,
        meal__owner_user_id=partner_id,
    ).select_related("meal", "slot"):
        slot_meal.meal = get_clone(slot_meal.meal)
        slot_meal.save(update_fields=["meal_id"])

    # Instance slot meal links
    for slot_meal in MealPlanInstanceSlotMeal.objects.filter(
        slot__instance__owner_user=owner,
        meal__owner_user_id=partner_id,
    ).select_related("meal", "slot"):
        slot_meal.meal = get_clone(slot_meal.meal)
        slot_meal.save(update_fields=["meal_id"])

    # Grocery lines
    for item in GroceryListItem.objects.filter(
        grocery_list__owner_user=owner,
        source_meal__owner_user_id=partner_id,
    ).select_related("source_meal"):
        if not item.source_meal_id:
            continue
        item.source_meal = get_clone(item.source_meal)
        item.save(update_fields=["source_meal_id"])


@transaction.atomic
def fork_both_users_on_disconnect(users: Iterable[User]) -> None:
    users = list(users)
    if len(users) != 2:
        return
    a, b = users[0], users[1]
    fork_partner_meals_for_user(owner=a, partner=b)
    fork_partner_meals_for_user(owner=b, partner=a)
