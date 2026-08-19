from django.db import migrations


def seed_reads_good(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="reads_good",
        defaults={
            "title": "Reads Good",
            "description": "Share your Goodreads feed with friends.",
            "category": "books",
            "order": 250,
            "show_on_public_profile": True,
        },
    )


def unseed_reads_good(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="reads_good").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0026_recommendations_achievements"),
    ]

    operations = [
        migrations.RunPython(seed_reads_good, unseed_reads_good),
    ]
