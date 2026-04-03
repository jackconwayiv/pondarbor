from django.db import migrations


def seed_pondclicker(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="pondclicker_tier_1_pond",
        defaults={
            "title": "Tier 1 Pond",
            "description": "Complete Tier 1 in PondClicker by owning pond snails, tadpoles, and water fleas.",
            "category": "pondclicker",
            "order": 50,
            "display_group": "pondclicker",
            "display_group_order": 1,
            "show_on_public_profile": True,
        },
    )


def unseed_pondclicker(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="pondclicker_tier_1_pond").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0003_friendly_achievement_descriptions"),
    ]

    operations = [
        migrations.RunPython(seed_pondclicker, unseed_pondclicker),
    ]
