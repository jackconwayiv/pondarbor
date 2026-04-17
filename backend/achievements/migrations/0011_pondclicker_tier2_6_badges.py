from django.db import migrations


def seed_pondclicker_tiers(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="pondclicker_tier_1_pond",
        defaults={
            "title": "Tier 1 Pond",
            "description": (
                "Complete Tier 1 in PondClicker by owning all five marquee denizens: "
                "pond snails, tadpoles, water fleas, dragonfly nymphs, and leeches."
            ),
            "category": "pondclicker",
            "order": 50,
            "display_group": "pondclicker",
            "display_group_order": 1,
            "show_on_public_profile": True,
        },
    )
    rows = [
        (
            "pondclicker_tier_2_pond",
            "Tier 2 Pond",
            (
                "Complete Tier 2 in PondClicker by owning all five marquee denizens: "
                "crayfish, minnows, green frogs, water striders, and diving beetles."
            ),
            51,
            2,
        ),
        (
            "pondclicker_tier_3_pond",
            "Tier 3 Pond",
            (
                "Complete Tier 3 in PondClicker by owning all five marquee denizens: "
                "bluegill, pumpkinseed sunfish, painted turtles, salamanders, and perch."
            ),
            52,
            3,
        ),
        (
            "pondclicker_tier_4_pond",
            "Tier 4 Pond",
            (
                "Complete Tier 4 in PondClicker by owning all five marquee denizens: "
                "largemouth bass, softshell turtle, bullfrogs, muskrats, and catfish."
            ),
            53,
            4,
        ),
        (
            "pondclicker_tier_5_pond",
            "Tier 5 Pond",
            (
                "Complete Tier 5 in PondClicker by owning all five marquee denizens: "
                "northern pike, snapping turtle, mallard ducks, great blue herons, "
                "and Canada geese."
            ),
            54,
            5,
        ),
        (
            "pondclicker_tier_6_pond",
            "Tier 6 Pond",
            (
                "Complete Tier 6 in PondClicker by owning all five marquee denizens: "
                "otters, beavers, bald eagles, bowfin, and mute swans."
            ),
            55,
            6,
        ),
    ]
    for slug, title, description, order, dgo in rows:
        AchievementDefinition.objects.update_or_create(
            slug=slug,
            defaults={
                "title": title,
                "description": description,
                "category": "pondclicker",
                "order": order,
                "display_group": "pondclicker",
                "display_group_order": dgo,
                "show_on_public_profile": True,
            },
        )


def unseed_pondclicker_tiers(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=[
            "pondclicker_tier_2_pond",
            "pondclicker_tier_3_pond",
            "pondclicker_tier_4_pond",
            "pondclicker_tier_5_pond",
            "pondclicker_tier_6_pond",
        ]
    ).delete()
    AchievementDefinition.objects.filter(slug="pondclicker_tier_1_pond").update(
        description=(
            "Complete Tier 1 in PondClicker by owning pond snails, tadpoles, and water fleas."
        ),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0010_songaday_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_pondclicker_tiers, unseed_pondclicker_tiers),
    ]
