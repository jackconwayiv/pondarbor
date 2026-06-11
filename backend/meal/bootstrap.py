"""Single-request initial payload for the Meal Maestro app."""

from __future__ import annotations

from friends.services import friend_ids_for_user

from meal.models import Meal, MealCategoryOption, MealPlanInstance, MealTag
from meal.views_partner import disconnect_pending_payload
from meal.serializers import (
    MealCategoryOptionSerializer,
    MealSerializer,
    SharedMealSerializer,
    UserIngredientInventorySerializer,
)


def _bootstrap_meals(*, request, meal_qs, scope_ids):
    from meal.meal_updates import attach_upcoming_slot_counts

    from meal.views import _maybe_attach_pantry_coverage, _meal_detail_prefetch

    qs = meal_qs.prefetch_related(*_meal_detail_prefetch()).order_by("-updated_at", "-id")
    meals = list(qs)
    attach_upcoming_slot_counts(meals, scope_ids)
    _maybe_attach_pantry_coverage(request, meals)
    meals.sort(
        key=lambda m: (
            -(
                getattr(m, "_pantry_coverage_pct", None)
                if getattr(m, "_pantry_coverage_pct", None) is not None
                else -1
            ),
            (m.title or "").lower(),
        ),
    )
    return MealSerializer(meals, many=True).data


def _bootstrap_shared_meals(*, request, user):
    from meal.views import _meal_detail_prefetch, _maybe_attach_pantry_coverage

    friend_ids = friend_ids_for_user(user=user)
    cloned_sources = Meal.objects.filter(owner_user=user).exclude(cloned_from_meal_id=None).values_list(
        "cloned_from_meal_id",
        flat=True,
    )
    qs = (
        Meal.objects.filter(owner_user_id__in=friend_ids, is_published_to_friends=True)
        .exclude(pk__in=cloned_sources)
        .select_related("owner_user", "owner_user__profile")
        .prefetch_related(*_meal_detail_prefetch())
        .order_by("-updated_at")
    )
    meals = list(qs)
    _maybe_attach_pantry_coverage(request, meals)
    return SharedMealSerializer(meals, many=True).data


def _bootstrap_instances(*, instance_qs):
    from meal.views import _serialize_instance

    qs = instance_qs.prefetch_related("slots").order_by("-week_start")
    return [_serialize_instance(inst) for inst in qs]


def _bootstrap_category_options(*, user):
    out: dict[str, list] = {}
    for axis in ("meal_type", "cuisine", "time"):
        qs = MealCategoryOption.objects.filter(owner_user=user, axis=axis).order_by("name")
        out[axis] = MealCategoryOptionSerializer(qs, many=True).data
    return out


def _bootstrap_tags(*, user):
    return list(
        MealTag.objects.filter(owner_user=user).order_by("name").values_list("name", flat=True),
    )


def _bootstrap_pantry(*, request, user, scope_ids, meal_qs, instance_qs):
    from users.models import Profile

    from meal.pantry_access import pantry_inventory_queryset
    from meal.pantry_recommendations import (
        attach_pantry_recommendation_hints,
        in_stock_ingredient_recommendation_hints,
    )

    profile, _ = Profile.objects.get_or_create(user=user)
    if not profile.meal_pantry_enabled:
        return None
    qs = pantry_inventory_queryset(user=user)
    rows = list(qs)
    hints = in_stock_ingredient_recommendation_hints(
        user=user,
        scope_ids=scope_ids,
        instance_qs=instance_qs,
        meal_qs=meal_qs,
        inventory_qs=qs,
        week_starts_on=int(profile.meal_week_starts_on),
    )
    attach_pantry_recommendation_hints(rows=rows, hints=hints)
    return UserIngredientInventorySerializer(rows, many=True, context={"request": request}).data


def meal_bootstrap_payload(*, request) -> dict:
    from meal.views import _instance_qs, _meal_qs, _scope_ids

    user = request.user
    scope_ids = _scope_ids(request)
    meal_qs = _meal_qs(request)
    instance_qs = _instance_qs(request)

    return {
        "meals": _bootstrap_meals(request=request, meal_qs=meal_qs, scope_ids=scope_ids),
        "shared_meals": _bootstrap_shared_meals(request=request, user=user),
        "instances": _bootstrap_instances(instance_qs=instance_qs),
        "category_options": _bootstrap_category_options(user=user),
        "tags": _bootstrap_tags(user=user),
        "pantry_inventory": _bootstrap_pantry(
            request=request,
            user=user,
            scope_ids=scope_ids,
            meal_qs=meal_qs,
            instance_qs=instance_qs,
        ),
        "disconnect_pending": disconnect_pending_payload(user=user),
    }
