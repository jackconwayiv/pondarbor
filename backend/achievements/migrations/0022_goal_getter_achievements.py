from django.db import migrations


def seed_goal_getter_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "goals_tri_goal_athlon",
            "title": "Tri-Goal-Athlon",
            "description": "Set 3 or more goals for yourself in Goal-Getter.",
            "category": "goals",
            "order": 230,
            "show_on_public_profile": True,
        },
        {
            "slug": "goals_streak_week",
            "title": "Streak Week",
            "description": "Achieve a streak of 7 or more in Goal-Getter.",
            "category": "goals",
            "order": 231,
            "show_on_public_profile": True,
        },
        {
            "slug": "goals_marathon_month",
            "title": "Marathon Month",
            "description": "Achieve a streak of 30 or more in Goal-Getter.",
            "category": "goals",
            "order": 232,
            "show_on_public_profile": True,
        },
        {
            "slug": "goals_checkpoint_charlie",
            "title": "Checkpoint Charlie",
            "description": "Mark 10 or more checkpoints as complete in Goal-Getter.",
            "category": "goals",
            "order": 233,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_goal_getter_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=(
            "goals_tri_goal_athlon",
            "goals_streak_week",
            "goals_marathon_month",
            "goals_checkpoint_charlie",
        )
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0021_estates_stunt_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_goal_getter_achievements, unseed_goal_getter_achievements),
    ]
