from __future__ import annotations

from django.contrib.auth import get_user_model

from django.db import transaction

from meal.models import MealPlanInstance, MealPlanInstanceSlot

User = get_user_model()

SLOTS_PER_DAY_MIN = 1
SLOTS_PER_DAY_MAX = 5


def clamp_slots_per_day(n: int) -> int:
    return max(SLOTS_PER_DAY_MIN, min(SLOTS_PER_DAY_MAX, int(n)))


def slots_per_day_for_user(user) -> int:
    from users.views import get_or_create_profile

    profile = get_or_create_profile(user)
    return clamp_slots_per_day(getattr(profile, "meal_slots_per_day", 3) or 3)


def rebuild_instance_slots(instance: MealPlanInstance, *, n: int | None = None) -> None:
    """Ensure visible slot rows (0..n-1 per day) exist. Hidden rows (slot_index >= n) are kept."""
    if n is None:
        n = slots_per_day_for_user(instance.owner_user)
    n = clamp_slots_per_day(n)
    for day in range(7):
        for slot in range(n):
            MealPlanInstanceSlot.objects.get_or_create(
                instance=instance,
                day_index=day,
                slot_index=slot,
            )


@transaction.atomic
def create_instance_with_grid(*, owner, week_start) -> MealPlanInstance:
    inst = MealPlanInstance.objects.create(
        owner_user=owner,
        week_start=week_start,
    )
    rebuild_instance_slots(inst)
    return inst


@transaction.atomic
def rebuild_all_instances_for_user(*, owner, slots_per_day: int) -> None:
    n = clamp_slots_per_day(slots_per_day)
    for inst in MealPlanInstance.objects.filter(owner_user=owner):
        rebuild_instance_slots(inst, n=n)
