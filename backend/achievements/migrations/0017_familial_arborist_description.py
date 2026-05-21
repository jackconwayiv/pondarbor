from django.db import migrations

NEW_DESCRIPTION = "Share 10 or more people in your Family Tree."
OLD_DESCRIPTION = "You've shared 10 or more People."


def apply_description(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="familial_arborist").update(
        description=NEW_DESCRIPTION,
    )


def revert_description(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="familial_arborist").update(
        description=OLD_DESCRIPTION,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0016_familial_arborist"),
    ]

    operations = [
        migrations.RunPython(apply_description, revert_description),
    ]
