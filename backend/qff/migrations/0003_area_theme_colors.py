from django.db import migrations, models


def set_village_of_ort_theme(apps, schema_editor):
    Area = apps.get_model("qff", "Area")
    # Light brown, tan, fatty yellow — Village of Ort
    ort = Area.objects.filter(slug="village-of-ort").first()
    if ort:
        ort.theme_primary = "#d4a574"
        ort.theme_secondary = "#8f6f4a"
        ort.theme_accent = "#f0e090"
        ort.save(
            update_fields=["theme_primary", "theme_secondary", "theme_accent"],
        )


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0002_seed_village_of_ort"),
    ]

    operations = [
        migrations.AddField(
            model_name="area",
            name="theme_primary",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
        migrations.AddField(
            model_name="area",
            name="theme_secondary",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
        migrations.AddField(
            model_name="area",
            name="theme_accent",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
        migrations.RunPython(set_village_of_ort_theme, migrations.RunPython.noop),
    ]
