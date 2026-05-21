from django.db import migrations


def seed_familial_arborist(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="familial_arborist",
        defaults={
            "title": "Familial Arborist",
            "description": "Share 10 or more people in your Family Tree.",
            "category": "people",
            "order": 140,
            "show_on_public_profile": True,
        },
    )


def unseed_familial_arborist(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="familial_arborist").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0015_whatif_dece_proposer"),
    ]

    operations = [
        migrations.RunPython(seed_familial_arborist, unseed_familial_arborist),
    ]
