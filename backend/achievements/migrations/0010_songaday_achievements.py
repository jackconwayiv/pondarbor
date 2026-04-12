from django.db import migrations


def seed_songaday_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "month_of_music",
            "title": "Month of Music",
            "description": "Submit 30 or more Song-a-Day entries.",
            "category": "songaday",
            "order": 100,
            "show_on_public_profile": True,
        },
        {
            "slug": "music_lover",
            "title": "Music Lover",
            "description": "Heart 10 or more of your friends’ Song-a-Day submissions.",
            "category": "songaday",
            "order": 110,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_songaday_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug__in=("month_of_music", "music_lover")).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0009_smell_it_achievement"),
    ]

    operations = [
        migrations.RunPython(seed_songaday_achievements, unseed_songaday_achievements),
    ]
