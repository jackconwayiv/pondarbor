from django.db import migrations


def seed_estates_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "estates_farmhand",
            "title": "Farmhand",
            "description": "Win the Farm in Estates 50 times.",
            "category": "estates",
            "order": 150,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_highwayman",
            "title": "Highwayman",
            "description": "Win the Road in Estates 50 times.",
            "category": "estates",
            "order": 160,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_lookout",
            "title": "Lookout",
            "description": "Win the Tower in Estates 50 times.",
            "category": "estates",
            "order": 170,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_gatekeeper",
            "title": "Gatekeeper",
            "description": "Win the Gate in Estates 50 times.",
            "category": "estates",
            "order": 180,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_monarch",
            "title": "Monarch",
            "description": "Win the Throne in Estates 50 times.",
            "category": "estates",
            "order": 190,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_royal",
            "title": "Royal",
            "description": "Win 5 or more games of Estates against other users.",
            "category": "estates",
            "order": 200,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_noble",
            "title": "Noble",
            "description": "Play 10 or more games of Estates.",
            "category": "estates",
            "order": 210,
            "show_on_public_profile": True,
        },
        {
            "slug": "estates_peasant",
            "title": "Peasant",
            "description": "Win 5 or more games of Estates against computer opponents.",
            "category": "estates",
            "order": 220,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_estates_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=(
            "estates_farmhand",
            "estates_highwayman",
            "estates_lookout",
            "estates_gatekeeper",
            "estates_monarch",
            "estates_royal",
            "estates_noble",
            "estates_peasant",
        )
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0017_familial_arborist_description"),
        ("estates", "0005_user_stats"),
    ]

    operations = [
        migrations.RunPython(seed_estates_achievements, unseed_estates_achievements),
    ]
