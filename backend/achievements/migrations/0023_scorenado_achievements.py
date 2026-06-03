from django.db import migrations


def seed_scorenado_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "scorenado_game_player",
            "title": "Game Player",
            "description": "Accept an invitation to a Scorenado game.",
            "category": "scorenado",
            "order": 240,
            "show_on_public_profile": True,
        },
        {
            "slug": "scorenado_hat_trick",
            "title": "Hat Trick",
            "description": "Accept 3+ invitations to Scorenado games you won.",
            "category": "scorenado",
            "order": 241,
            "show_on_public_profile": True,
        },
        {
            "slug": "scorenado_drosselmeyer",
            "title": "Drosselmeyer",
            "description": "Create 3+ shared Scorenado game templates.",
            "category": "scorenado",
            "order": 242,
            "show_on_public_profile": True,
        },
        {
            "slug": "scorenado_scorekeeper",
            "title": "Scorekeeper",
            "description": (
                "Score 5+ finalized Scorenado games with at least one other "
                "accepted player who is not you."
            ),
            "category": "scorenado",
            "order": 243,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_scorenado_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=(
            "scorenado_game_player",
            "scorenado_hat_trick",
            "scorenado_drosselmeyer",
            "scorenado_scorekeeper",
        )
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0022_goal_getter_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_scorenado_achievements, unseed_scorenado_achievements),
    ]
