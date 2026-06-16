from django.db import migrations, models

from recommendations.constants import PRESET_CATEGORIES, CategoryGroup


def seed_links_category(apps, schema_editor):
    Category = apps.get_model("recommendations", "RecommendationCategory")
    row = next(r for r in PRESET_CATEGORIES if r["slug"] == "links")
    Category.objects.update_or_create(
        slug=row["slug"],
        defaults={
            "name": row["name"],
            "emoji": row["emoji"],
            "group": row["group"],
            "is_preset": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("recommendations", "0004_entry_media_metadata"),
    ]

    operations = [
        migrations.AlterField(
            model_name="recommendationcategory",
            name="group",
            field=models.CharField(
                choices=[
                    ("places", "Places"),
                    ("media", "Media"),
                    ("links", "Links"),
                ],
                db_index=True,
                default=CategoryGroup.MEDIA,
                max_length=16,
            ),
        ),
        migrations.RunPython(seed_links_category, migrations.RunPython.noop),
    ]
