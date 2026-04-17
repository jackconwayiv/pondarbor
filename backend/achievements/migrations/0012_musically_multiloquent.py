from django.db import migrations


def seed_musically_multiloquent(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.update_or_create(
        slug="musically_multiloquent",
        defaults={
            "title": "Musically Multiloquent",
            "description": "Comment on 10+ Song-a-Day posts from friends.",
            "category": "songaday",
            "order": 120,
            "show_on_public_profile": True,
        },
    )


def unseed_musically_multiloquent(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(slug="musically_multiloquent").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0011_pondclicker_tier2_6_badges"),
    ]

    operations = [
        migrations.RunPython(seed_musically_multiloquent, unseed_musically_multiloquent),
    ]
