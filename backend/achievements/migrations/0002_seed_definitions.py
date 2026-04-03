from django.db import migrations


def seed_definitions(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "archivist",
            "title": "Archivist",
            "description": "Have 10 or more quotes.",
            "category": "quotes",
            "order": 10,
        },
        {
            "slug": "town_crier",
            "title": "Town Crier",
            "description": "Have 10 or more public quotes.",
            "category": "quotes",
            "order": 20,
        },
        {
            "slug": "whatif_wiz",
            "title": "WhatIf Wiz",
            "description": "Win a multiplayer game of WhatIf.",
            "category": "whatif",
            "order": 30,
        },
        {
            "slug": "whatif_warrior",
            "title": "WhatIf Warrior",
            "description": "Complete 5 games of WhatIf.",
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
