from django.db import migrations


def seed_estates_stunt_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "estates_throned_ya",
            "title": "Throne'd Ya!",
            "description": "Score the Throne with a 1 against a human opponent in Estates.",
            "category": "estates",
            "order": 225,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_farmed_ya",
            "title": "Farmed Ya!",
            "description": "Score the Farm with a 1 against a human opponent in Estates.",
            "category": "estates",
            "order": 230,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_estates_stunt_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=("estates_throned_ya", "estates_farmed_ya")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0020_peer_into_the_stars"),
    ]

    operations = [
        migrations.RunPython(seed_estates_stunt_achievements, unseed_estates_stunt_achievements),
    ]
