from django.db import migrations


def seed_meal_maestro_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "thats_amore",
            "title": "That's Amore",
            "description": "Link up with another user as Meal Maestro partners.",
            "category": "meal",
            "order": 90,
            "show_on_public_profile": True,
        },
        {
            "slug": "tasty_plans",
            "title": "Tasty Plans",
            "description": "Fill 14 or more slots (each with at least one meal) in a single weekly Meal Maestro plan.",
            "category": "meal",
            "order": 91,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_meal_maestro_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug__in=("thats_amore", "tasty_plans")).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0006_userachievement_visible_to_friends"),
    ]

    operations = [
        migrations.RunPython(seed_meal_maestro_achievements, unseed_meal_maestro_achievements),
    ]
