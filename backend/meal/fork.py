"""
When a mutual meal pair ends, clone partner-owned meals/recipes referenced from
the current user's templates, instances, and grocery lines into the current user's
ownership and rewrite FKs.
"""

from __future__ import annotations

from collections.abc import Iterable

from django.contrib.auth import get_user_model
from django.db import transaction

from meal.models import (
    GroceryListItem,
    Meal,
    MealPlanInstanceSlot,
    MealPlanTemplateSlot,
    MealRecipe,
    Recipe,
    RecipeIngredient,
)

User = get_user_model()


def _clone_recipe_for_user(*, recipe: Recipe, new_owner) -> Recipe:
    nr = Recipe.objects.create(
        owner_user=new_owner,
        title=recipe.title,
        directions=recipe.directions,
        notes=recipe.notes,
        cloned_from_recipe=recipe,
    )
    for ing in recipe.ingredients.all():
        RecipeIngredient.objects.create(
            recipe=nr,
            position=ing.position,
            raw_line=ing.raw_line,
            amount=ing.amount,
            unit=ing.unit,
            name=ing.name,
        )
    return nr


def _clone_meal_for_user(*, meal: Meal, new_owner, recipe_map: dict[int, Recipe]) -> Meal:
    new_meal = Meal.objects.create(
        owner_user=new_owner,
        title=meal.title,
        blurb=meal.blurb,
        cloned_from_meal=meal,
    )
    for link in meal.meal_recipes.order_by("position", "id").select_related("recipe"):
        src = link.recipe_id
        if src not in recipe_map:
            recipe_map[src] = _clone_recipe_for_user(recipe=link.recipe, new_owner=new_owner)
        MealRecipe.objects.create(
            meal=new_meal,
            recipe=recipe_map[src],
            position=link.position,
        )
    return new_meal


def fork_partner_meals_for_user(*, owner: User, partner: User) -> None:
    """
    For every partner-owned Meal referenced from owner-owned slots or grocery rows,
    clone into owner's account (dedupe recipes) and rewrite references.
    """
    partner_id = partner.id
    meal_map: dict[int, Meal] = {}
    recipe_map: dict[int, Recipe] = {}

    def get_clone(m: Meal) -> Meal:
        if m.id in meal_map:
            return meal_map[m.id]
        if m.owner_user_id != partner_id:
            return m
        cloned = _clone_meal_for_user(meal=m, new_owner=owner, recipe_map=recipe_map)
        meal_map[m.id] = cloned
        return cloned

    # Template slots
    for slot in MealPlanTemplateSlot.objects.filter(
        template__owner_user=owner,
        meal__owner_user_id=partner_id,
    ).select_related("meal"):
        if not slot.meal_id:
            continue
        slot.meal = get_clone(slot.meal)
        slot.save(update_fields=["meal_id"])

    # Instance slots
    for slot in MealPlanInstanceSlot.objects.filter(
        instance__owner_user=owner,
        meal__owner_user_id=partner_id,
    ).select_related("meal"):
        if not slot.meal_id:
            continue
        slot.meal = get_clone(slot.meal)
        slot.save(update_fields=["meal_id"])

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
