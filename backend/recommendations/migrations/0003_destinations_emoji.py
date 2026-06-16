from django.db import migrations


def update_destinations_emoji(apps, schema_editor):
    Category = apps.get_model("recommendations", "RecommendationCategory")
    Category.objects.filter(slug="destinations").update(emoji="🎡")


class Migration(migrations.Migration):
    dependencies = [
        ("recommendations", "0002_category_groups"),
    ]

    operations = [
        migrations.RunPython(update_destinations_emoji, migrations.RunPython.noop),
    ]
