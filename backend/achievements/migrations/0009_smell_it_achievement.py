from django.db import migrations


def seed_smell(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="i_can_smell_it_from_here",
        defaults={
            "title": "I Can Smell It From Here",
            "description": "Save a friend's recipe to your own Meal Maestro account.",
            "category": "meal",
            "order": 93,
            "show_on_public_profile": True,
        },
    )


def unseed_smell(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="i_can_smell_it_from_here").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0008_smorgasbord_achievement"),
    ]

    operations = [
        migrations.RunPython(seed_smell, unseed_smell),
    ]
