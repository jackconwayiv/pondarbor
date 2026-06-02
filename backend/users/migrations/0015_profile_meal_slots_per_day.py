from django.db import migrations, models


def seed_meal_slots_per_day(apps, schema_editor):
    Profile = apps.get_model("users", "Profile")
    MealPlanTemplate = apps.get_model("meal", "MealPlanTemplate")
    MealPlanInstanceSlot = apps.get_model("meal", "MealPlanInstanceSlot")
    for profile in Profile.objects.all():
        tpl = (
            MealPlanTemplate.objects.filter(owner_user_id=profile.user_id)
            .order_by("-updated_at")
            .first()
        )
        if tpl is not None:
            profile.meal_slots_per_day = max(1, min(5, int(tpl.slots_per_day)))
        else:
            max_slot = (
                MealPlanInstanceSlot.objects.filter(instance__owner_user_id=profile.user_id)
                .order_by("-slot_index")
                .values_list("slot_index", flat=True)
                .first()
            )
            profile.meal_slots_per_day = max(1, min(5, (max_slot + 1) if max_slot is not None else 3))
        profile.save(update_fields=["meal_slots_per_day"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0014_profile_achievement_inbox_read_slugs"),
        ("meal", "0015_ingredient_created_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="meal_slots_per_day",
            field=models.PositiveSmallIntegerField(
                default=3,
                help_text="Meal plan rows per day (1–5); adding a row applies to every day.",
            ),
        ),
        migrations.RunPython(seed_meal_slots_per_day, migrations.RunPython.noop),
    ]
