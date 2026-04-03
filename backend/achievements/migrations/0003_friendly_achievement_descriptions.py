from django.db import migrations


COPY = {
    "archivist": "Have 10 or more quotes.",
    "town_crier": "Have 10 or more public quotes.",
    "whatif_wiz": "Win a multiplayer game of WhatIf.",
    "whatif_warrior": "Complete 5 games of WhatIf.",
}


def apply_friendly_descriptions(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    for slug, description in COPY.items():
        AchievementDefinition.objects.filter(slug=slug).update(description=description)


def revert_descriptions(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    old = {
        "archivist": "Recorded 10 or more quotes at once (non-deleted).",
        "town_crier": "Had 10 or more public quotes at once (non-deleted).",
        "whatif_wiz": "Won a completed WhatIf game with 3 or more players in the room.",
        "whatif_warrior": "Played 5 or more completed WhatIf games (logged-in player).",
    }
    for slug, description in old.items():
        AchievementDefinition.objects.filter(slug=slug).update(description=description)


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0002_seed_definitions"),
    ]

    operations = [
        migrations.RunPython(apply_friendly_descriptions, revert_descriptions),
    ]
