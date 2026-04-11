"""Apply validated meal writes (tags, categories, publish) and list helpers."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from meal.models import Meal, MealCategoryAxis, MealPlanInstanceSlotMeal
from meal.publish import meal_eligible_for_publish
from meal.tagging import replace_meal_tags, resolve_category_option


def attach_upcoming_slot_counts(meals: list[Meal], scope_ids: set[int]) -> None:
    today = timezone.localdate()
    ids = [m.id for m in meals]
    counts = {i: 0 for i in ids}
    if not ids:
        return
    for row in MealPlanInstanceSlotMeal.objects.filter(
        meal_id__in=ids,
        slot__instance__owner_user_id__in=scope_ids,
    ).select_related("slot__instance"):
        slot_date = row.slot.instance.week_start + timedelta(days=int(row.slot.day_index))
        if slot_date >= today:
            counts[row.meal_id] = counts.get(row.meal_id, 0) + 1
    for m in meals:
        m._upcoming_slot_count = counts.get(m.id, 0)


def filter_meals_queryset(request, qs):
    """Filter + order (except upcoming_slot_count — handled in view)."""
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(blurb__icontains=q) | Q(directions__icontains=q))

    tags_raw = (request.GET.get("tags") or "").strip()
    if tags_raw:
        for part in tags_raw.split(","):
            t = part.strip()
            if t:
                qs = qs.filter(tags__name__iexact=t)
        qs = qs.distinct()

    def _int_param(name: str) -> int | None:
        raw = (request.GET.get(name) or "").strip()
        if not raw:
            return None
        try:
            return int(raw)
        except ValueError:
            return None

    mt = _int_param("meal_type_id")
    if mt is not None:
        qs = qs.filter(meal_type_option_id=mt)
    cu = _int_param("cuisine_id")
    if cu is not None:
        qs = qs.filter(cuisine_option_id=cu)
    tm = _int_param("time_id")
    if tm is not None:
        qs = qs.filter(time_option_id=tm)

    sort = (request.GET.get("sort") or "updated_at").strip()
    if sort not in ("title", "updated_at", "upcoming_slot_count"):
        sort = "updated_at"
    if sort == "title":
        qs = qs.order_by("title", "id")
    elif sort == "upcoming_slot_count":
        qs = qs.order_by("-updated_at", "-id")
    else:
        qs = qs.order_by("-updated_at", "-id")
    return qs, sort


def apply_meal_validated(*, meal: Meal, data: dict, partial: bool) -> None:
    owner = meal.owner_user

    if "tag_names" in data:
        replace_meal_tags(meal=meal, tag_names=list(data.get("tag_names") or []))

    fk_map = [
        ("meal_type_id", "meal_type_option", MealCategoryAxis.MEAL_TYPE.value),
        ("cuisine_id", "cuisine_option", MealCategoryAxis.CUISINE.value),
        ("time_id", "time_option", MealCategoryAxis.TIME.value),
    ]
    for key, attr, axis in fk_map:
        if partial and key not in data:
            continue
        if not partial and key not in data:
            continue
        opt_id = data.get(key)
        setattr(
            meal,
            attr,
            resolve_category_option(owner=owner, axis=axis, option_id=opt_id),
        )

    if partial:
        if "is_published_to_friends" in data:
            if data["is_published_to_friends"] and not meal_eligible_for_publish(meal):
                raise ValidationError(
                    {"is_published_to_friends": "Add at least one ingredient and directions before publishing."},
                )
            meal.is_published_to_friends = bool(data["is_published_to_friends"])
    else:
        if data.get("is_published_to_friends") and not meal_eligible_for_publish(meal):
            raise ValidationError(
                {"is_published_to_friends": "Add at least one ingredient and directions before publishing."},
            )
        meal.is_published_to_friends = bool(data.get("is_published_to_friends", False))

    if not meal_eligible_for_publish(meal):
        meal.is_published_to_friends = False
