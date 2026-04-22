from django.db import migrations


def seed_schedule_coordinator(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="schedule_coordinator",
        defaults={
            "title": "Schedule Coordinator",
            "description": "Share one or more calendars with your PondArbor friends.",
            "category": "calendar",
            "order": 130,
            "show_on_public_profile": True,
        },
    )


def unseed_schedule_coordinator(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="schedule_coordinator").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0013_pondclicker_tier7_prestige_pond"),
    ]

    operations = [
        migrations.RunPython(seed_schedule_coordinator, unseed_schedule_coordinator),
    ]
