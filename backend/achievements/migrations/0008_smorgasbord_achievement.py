from django.db import migrations


def seed_smorgasbord(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="smorgasbord",
        defaults={
            "title": "Smorgasbord",
            "description": "Have 20+ meals saved in Meal Maestro.",
            "category": "meal",
            "order": 92,
            "show_on_public_profile": True,
        },
    )


def unseed_smorgasbord(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="smorgasbord").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0007_meal_maestro_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_smorgasbord, unseed_smorgasbord),
    ]
