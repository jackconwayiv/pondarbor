from django.db import migrations


def seed_closet_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    rows = [
        {
            "slug": "sharing_is_caring",
            "title": "Sharing is Caring",
            "description": "Offer 5 or more items to the Community Closet.",
            "category": "closet",
            "order": 60,
            "show_on_public_profile": True,
        },
        {
            "slug": "something_borrowed",
            "title": "Something Borrowed",
            "description": "Borrow and return someone else's item in the Community Closet.",
            "category": "closet",
            "order": 70,
            "show_on_public_profile": True,
        },
        {
            "slug": "good_as_new",
            "title": "Good as New",
            "description": "In the Community Closet, loan an item to a friend and receive it back.",
            "category": "closet",
            "order": 80,
            "show_on_public_profile": True,
        },
    ]
    for row in rows:
        AchievementDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


def unseed_closet_achievements(apps, schema_editor):
    AchievementDefinition = apps.get_model("achievements", "AchievementDefinition")
    AchievementDefinition.objects.filter(
        slug__in=("sharing_is_caring", "something_borrowed", "good_as_new")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("achievements", "0004_pondclicker_tier1_badge"),
    ]

    operations = [
        migrations.RunPython(seed_closet_achievements, unseed_closet_achievements),
    ]
