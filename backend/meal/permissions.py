from __future__ import annotations

from django.shortcuts import get_object_or_404

from meal.models import Meal
from meal.partner import meal_partner_user_ids


def meal_readable_by(meal: Meal, user) -> bool:
    return meal.owner_user_id in meal_partner_user_ids(user=user)


def get_meal_for_user(meal_id: int, user):
    return get_object_or_404(
        Meal.objects.filter(owner_user_id__in=meal_partner_user_ids(user=user)),
        id=meal_id,
    )
