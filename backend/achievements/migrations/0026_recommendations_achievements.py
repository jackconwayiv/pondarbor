from django.db import migrations


def seed_recommendations_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "recommendations_ten_ten_no_notes",
            "title": "10/10 No Notes",
            "description": "Share a recommendation.",
            "category": "recommendations",
            "order": 240,
            "show_on_public_profile": True,
        },
        {
            "slug": "recommendations_and_also",
            "title": "And Also...",
            "description": "Comment on another user's recommendation.",
            "category": "recommendations",
            "order": 241,
            "show_on_public_profile": True,
        },
        {
            "slug": "recommendations_five_stars",
            "title": "Five Stars",
            "description": "Give a rating to five or more recommendations.",
            "category": "recommendations",
            "order": 242,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_recommendations_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=(
            "recommendations_ten_ten_no_notes",
            "recommendations_and_also",
            "recommendations_five_stars",
        )
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0025_goals_lifes_a_chore_on_target"),
    ]

    operations = [
        migrations.RunPython(seed_recommendations_achievements, unseed_recommendations_achievements),
    ]
