from django.db import migrations, models

from recommendations.constants import PRESET_CATEGORIES, CategoryGroup


def apply_category_groups(apps, schema_editor):
    Category = apps.get_model("recommendations", "RecommendationCategory")
    Entry = apps.get_model("recommendations", "Entry")

    for row in PRESET_CATEGORIES:
        Category.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "emoji": row["emoji"],
                "group": row["group"],
                "is_preset": True,
            },
        )

    travel = Category.objects.filter(slug="travel").first()
    destinations = Category.objects.filter(slug="destinations").first()
    if travel and destinations:
        Entry.objects.filter(category=travel).update(category=destinations)
        travel.delete()

    # Legacy slugs without a group assignment default to media.
    Category.objects.filter(group="").update(group=CategoryGroup.MEDIA)


class Migration(migrations.Migration):
    dependencies = [
        ("recommendations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="recommendationcategory",
            name="group",
            field=models.CharField(
                choices=[("places", "Places"), ("media", "Media")],
                db_index=True,
                default="media",
                max_length=16,
            ),
        ),
        migrations.RunPython(apply_category_groups, migrations.RunPython.noop),
    ]
