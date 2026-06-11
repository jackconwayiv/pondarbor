from django.db import migrations


def seed_welcome_to_pond_arbor(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="welcome_to_pond_arbor",
        defaults={
            "title": "Welcome to Pond Arbor!",
            "description": "Complete the onboarding process.",
            "category": "onboarding",
            "order": 5,
            "show_on_public_profile": True,
        },
    )


def unseed_welcome_to_pond_arbor(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="welcome_to_pond_arbor").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0023_scorenado_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_welcome_to_pond_arbor, unseed_welcome_to_pond_arbor),
    ]
