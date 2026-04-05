from django.db import migrations, models


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
    ]
