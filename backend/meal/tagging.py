"""Tag and category assignment for meals (owner-scoped vocabulary)."""

from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import ValidationError

from meal.models import Meal, MealCategoryAxis, MealCategoryOption, MealTag


def get_or_create_tag_for_owner(*, owner, name: str) -> MealTag:
    raw = (name or "").strip()
    if not raw:
        raise ValueError("empty tag")
    existing = MealTag.objects.filter(owner_user=owner, name__iexact=raw).first()
    if existing:
        return existing
    return MealTag.objects.create(owner_user=owner, name=raw)


@transaction.atomic
def replace_meal_tags(*, meal: Meal, tag_names: list[str]) -> None:
    owner = meal.owner_user
    tags: list[MealTag] = []
    seen_lower: set[str] = set()
    for raw in tag_names:
        t = get_or_create_tag_for_owner(owner=owner, name=raw)
        key = t.name.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        tags.append(t)
    meal.tags.set(tags)


def resolve_category_option(
    *,
    owner,
    axis: str,
    option_id: int | None,
) -> MealCategoryOption | None:
    if option_id is None:
        return None
    opt = MealCategoryOption.objects.filter(
        pk=option_id,
        owner_user=owner,
        axis=axis,
    ).first()
    if opt is None:
        raise ValidationError({axis: "Invalid category option for this account."})
    return opt


def ensure_category_option(*, owner, axis: str, name: str) -> MealCategoryOption:
    raw = (name or "").strip()
    if not raw:
        raise ValueError("empty category name")
    allowed = {x.value for x in MealCategoryAxis}
    if axis not in allowed:
        raise ValueError("invalid axis")
    existing = MealCategoryOption.objects.filter(
        owner_user=owner,
        axis=axis,
        name__iexact=raw,
    ).first()
    if existing:
        return existing
    return MealCategoryOption.objects.create(owner_user=owner, axis=axis, name=raw)
