from django.db import migrations

NEW_DESCRIPTION = "Share your Goodreads feed with friends."
OLD_DESCRIPTION = "Have one or more books show up in the Books feed."


def apply_description(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="reads_good").update(
        description=NEW_DESCRIPTION,
    )


def revert_description(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="reads_good").update(
        description=OLD_DESCRIPTION,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0027_reads_good"),
    ]

    operations = [
        migrations.RunPython(apply_description, revert_description),
    ]
