"""Rules for publishing meals to friends."""

from __future__ import annotations

from meal.models import Meal


def meal_eligible_for_publish(meal: Meal) -> bool:
    if not (meal.directions or "").strip():
        return False
    return meal.ingredients.exists()
