from __future__ import annotations

from django.db import transaction

from meal.models import MealPlanTemplate, MealPlanTemplateSlot


def rebuild_template_slots(template: MealPlanTemplate) -> None:
    """Ensure 7 × slots_per_day rows exist; drop meals in removed cells when shrinking."""
    n = template.slots_per_day
    if n < 1 or n > 5:
        raise ValueError("slots_per_day must be 1–5")

    for day in range(7):
        for slot in range(n):
            MealPlanTemplateSlot.objects.get_or_create(
                template=template,
                day_index=day,
                slot_index=slot,
            )
        MealPlanTemplateSlot.objects.filter(
            template=template,
            day_index=day,
            slot_index__gte=n,
        ).delete()


@transaction.atomic
def create_template_with_grid(*, owner, name: str, description: str, slots_per_day: int) -> MealPlanTemplate:
    t = MealPlanTemplate.objects.create(
        owner_user=owner,
        name=name,
        description=description,
        slots_per_day=slots_per_day,
    )
    rebuild_template_slots(t)
    return t


def rebuild_instance_slots(instance) -> None:
    """Match instance slot grid to template's slots_per_day from source_template if present, else owner preference."""
    from meal.models import MealPlanInstanceSlot

    n = 3
    st = instance.source_template
    if st:
        n = st.slots_per_day
    for day in range(7):
        for slot in range(n):
            MealPlanInstanceSlot.objects.get_or_create(
                instance=instance,
                day_index=day,
                slot_index=slot,
            )
        MealPlanInstanceSlot.objects.filter(
            instance=instance,
            day_index=day,
            slot_index__gte=n,
        ).delete()


def copy_template_to_instance(*, template: MealPlanTemplate, instance) -> None:
    from meal.models import MealPlanInstanceSlot, MealPlanInstanceSlotMeal

    instance.source_template = template
    instance.save(update_fields=["source_template", "updated_at"])
    MealPlanInstanceSlot.objects.filter(instance=instance).delete()
    for ts in template.slots.prefetch_related("slot_meals").all():
        inst_slot = MealPlanInstanceSlot.objects.create(
            instance=instance,
            day_index=ts.day_index,
            slot_index=ts.slot_index,
        )
        MealPlanInstanceSlotMeal.objects.bulk_create(
            [MealPlanInstanceSlotMeal(slot=inst_slot, meal_id=sm.meal_id) for sm in ts.slot_meals.all()],
            ignore_conflicts=True,
        )
