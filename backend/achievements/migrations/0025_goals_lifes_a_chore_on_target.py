from django.db import migrations


def seed_goals_chore_and_project_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "goals_lifes_a_chore",
            "title": "Life's a Chore",
            "description": "Complete 5 or more chores on the same day in Goal-Getter.",
            "category": "goals",
            "order": 234,
            "show_on_public_profile": True,
        },
        {
            "slug": "goals_on_target",
            "title": "On Target",
            "description": "Mark 5 or more projects as complete in Goal-Getter.",
            "category": "goals",
            "order": 235,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_goals_chore_and_project_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=("goals_lifes_a_chore", "goals_on_target")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0024_welcome_to_pond_arbor"),
    ]

    operations = [
        migrations.RunPython(
            seed_goals_chore_and_project_achievements,
            unseed_goals_chore_and_project_achievements,
        ),
    ]
