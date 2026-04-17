from django.db import migrations


def seed_pondclicker_tier7(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="pondclicker_tier_7_pond",
        defaults={
            "title": "Prestige Pond",
            "description": (
                "You have fostered the 10 prestige denizens of PondClicker. "
                "You are an apex pond builder!"
            ),
            "category": "pondclicker",
            "order": 56,
            "display_group": "pondclicker",
            "display_group_order": 7,
            "show_on_public_profile": True,
        },
    )


def unseed_pondclicker_tier7(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="pondclicker_tier_7_pond").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0012_musically_multiloquent"),
    ]

    operations = [
        migrations.RunPython(seed_pondclicker_tier7, unseed_pondclicker_tier7),
    ]
