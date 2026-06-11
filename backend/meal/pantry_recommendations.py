"""Per-ingredient pantry hints for inventory cards (not scheduled / no recipes)."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone

from meal.dates import normalize_week_start
from meal.ingredients import repair_null_meal_ingredient_fks
from meal.models import MealIngredient, MealPlanInstanceSlotMeal, UserIngredientInventory
from meal.partner import meal_partner_user_ids


def in_stock_ingredient_recommendation_hints(
    *,
    user: AbstractBaseUser,
    scope_ids: set[int],
    instance_qs,
    meal_qs,
    inventory_qs,
    week_starts_on: int,
) -> dict[int, str]:
    """
    Map ingredient_id -> ``not_scheduled`` | ``no_recipes`` for in-stock pantry rows.

    - ``no_recipes``: in pantry, not used in any library meal.
    - ``not_scheduled``: in pantry, in library, not on this week's shared plan.
    """
    repair_null_meal_ingredient_fks(owner_user_ids=meal_partner_user_ids(user=user))

    anchor = normalize_week_start(timezone.localdate(), int(week_starts_on))
    scope_instances = instance_qs.filter(week_start=anchor)
    planned_meal_ids: set[int] = set()
    for mid in MealPlanInstanceSlotMeal.objects.filter(slot__instance__in=scope_instances).values_list(
        "meal_id",
        flat=True,
    ):
        planned_meal_ids.add(mid)

    planned_ingredient_ids: set[int] = set()
    if planned_meal_ids:
        for iid in (
            MealIngredient.objects.filter(meal_id__in=planned_meal_ids)
            .exclude(ingredient_id=None)
            .values_list("ingredient_id", flat=True)
            .distinct()
        ):
            planned_ingredient_ids.add(iid)

    all_library_ingredient_ids: set[int] = set(
        MealIngredient.objects.filter(meal__owner_user_id__in=scope_ids)
        .exclude(ingredient_id=None)
        .values_list("ingredient_id", flat=True)
        .distinct(),
    )

    hints: dict[int, str] = {}
    seen: set[int] = set()
    for row in inventory_qs:
        if row.quantity == 0 and row.simple_have is not True:
            continue
        iid = row.ingredient_id
        if iid in seen:
            continue
        seen.add(iid)

        if iid not in all_library_ingredient_ids:
            hints[iid] = "no_recipes"
            continue

        if iid in planned_ingredient_ids:
            continue

        has_unplanned_meal = meal_qs.filter(ingredients__ingredient_id=iid).exists()
        if planned_meal_ids:
            has_unplanned_meal = meal_qs.filter(ingredients__ingredient_id=iid).exclude(
                pk__in=planned_meal_ids,
            ).exists()
        if has_unplanned_meal:
            hints[iid] = "not_scheduled"

    return hints


def attach_pantry_recommendation_hints(
    *,
    rows: list[UserIngredientInventory],
    hints: dict[int, str],
) -> None:
    for row in rows:
        if row.quantity == 0 and row.simple_have is not True:
            row._pantry_recommendation_hint = None
            continue
        row._pantry_recommendation_hint = hints.get(row.ingredient_id)
