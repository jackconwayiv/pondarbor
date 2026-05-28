from django.db import migrations


def seed_peer_into_the_stars(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="peer_into_the_stars",
        defaults={
            "title": "Peer into the Stars",
            "description": "Obtain your natal chart at the Zodiackary.",
            "category": "zodiac",
            "order": 150,
            "show_on_public_profile": True,
        },
    )


def unseed_peer_into_the_stars(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="peer_into_the_stars").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0019_pondclicker_milestone_badges"),
    ]

    operations = [
        migrations.RunPython(seed_peer_into_the_stars, unseed_peer_into_the_stars),
    ]
