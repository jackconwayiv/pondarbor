from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0006_meal_source_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="meal",
            name="image_key",
            field=models.CharField(blank=True, max_length=512),
        ),
    ]
