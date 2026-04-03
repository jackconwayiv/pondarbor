from django.db import migrations


def seed_definitions(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "archivist",
            "title": "Archivist",
            "description": "Recorded 10 or more quotes at once (non-deleted).",
            "category": "quotes",
            "order": 10,
        },
        {
            "slug": "town_crier",
            "title": "Town Crier",
            "description": "Had 10 or more public quotes at once (non-deleted).",
            "category": "quotes",
            "order": 20,
        },
        {
            "slug": "whatif_wiz",
            "title": "WhatIf Wiz",
            "description": "Won a completed WhatIf game with 3 or more players in the room.",
            "category": "whatif",
            "order": 30,
        },
        {
            "slug": "whatif_warrior",
            "title": "WhatIf Warrior",
            "description": "Played 5 or more completed WhatIf games (logged-in player).",
            "category": "whatif",
            "order": 40,
        },
    ]
    for r in rows:
        AchievementDefinition.objects.update_or_create(slug=r["slug"], defaults=r)


def unseed_definitions(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=("archivist", "town_crier", "whatif_wiz", "whatif_warrior")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_definitions, unseed_definitions),
    ]
