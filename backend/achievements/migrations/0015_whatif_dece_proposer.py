from django.db import migrations


def seed_whatif_dece_proposer(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="whatif_dece_proposer",
        defaults={
            "title": "Dece Proposer",
            "description": "Propose 5+ questions for WhatIf that are added to the game.",
            "category": "whatif",
            "order": 45,
            "show_on_public_profile": True,
        },
    )


def unseed_whatif_dece_proposer(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="whatif_dece_proposer").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0014_schedule_coordinator"),
    ]

    operations = [
        migrations.RunPython(seed_whatif_dece_proposer, unseed_whatif_dece_proposer),
    ]
