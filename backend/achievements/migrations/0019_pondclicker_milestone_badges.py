from django.db import migrations


def seed_pondclicker_milestone_badges(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "pondclicker_pond_pawn",
            "title": "Pond Pawn",
            "description": "Earn 50 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 57,
            "display_group": "pondclicker",
            "display_group_order": 8,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_tadpole_traveler",
            "title": "Tadpole Traveler",
            "description": "Earn 100 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 58,
            "display_group": "pondclicker",
            "display_group_order": 9,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_pond_pioneer",
            "title": "Pond Pioneer",
            "description": "Earn 150 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 59,
            "display_group": "pondclicker",
            "display_group_order": 10,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_lily_pad_leaper",
            "title": "Lily Pad Leaper",
            "description": "Earn 200 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 60,
            "display_group": "pondclicker",
            "display_group_order": 11,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_wetland_wanderer",
            "title": "Wetland Wanderer",
            "description": "Earn 250 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 61,
            "display_group": "pondclicker",
            "display_group_order": 12,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_marsh_warden",
            "title": "Marsh Warden",
            "description": "Earn 300 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 62,
            "display_group": "pondclicker",
            "display_group_order": 13,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_current_commander",
            "title": "Current Commander",
            "description": "Earn 350 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 63,
            "display_group": "pondclicker",
            "display_group_order": 14,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_stillwater_strategist",
            "title": "Stillwater Strategist",
            "description": "Earn 400 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 64,
            "display_group": "pondclicker",
            "display_group_order": 15,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_ecosystem_architect",
            "title": "Ecosystem Architect",
            "description": "Earn 450 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 65,
            "display_group": "pondclicker",
            "display_group_order": 16,
            "show_on_public_profile": True,
        },
        {
            "slug": "pondclicker_pond_potentate",
            "title": "Pond Potentate",
            "description": "Earn 500 milestones in PondClicker Redux.",
            "category": "pondclicker",
            "order": 66,
            "display_group": "pondclicker",
            "display_group_order": 17,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_pondclicker_milestone_badges(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=(
            "pondclicker_pond_pawn",
            "pondclicker_tadpole_traveler",
            "pondclicker_pond_pioneer",
            "pondclicker_lily_pad_leaper",
            "pondclicker_wetland_wanderer",
            "pondclicker_marsh_warden",
            "pondclicker_current_commander",
            "pondclicker_stillwater_strategist",
            "pondclicker_ecosystem_architect",
            "pondclicker_pond_potentate",
        )
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0018_estates_achievements"),
    ]

    operations = [
        migrations.RunPython(
            seed_pondclicker_milestone_badges,
            unseed_pondclicker_milestone_badges,
        ),
    ]
