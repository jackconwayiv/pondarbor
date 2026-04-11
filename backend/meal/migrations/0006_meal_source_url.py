from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0005_meal_unify_and_multi_slot"),
    ]

    operations = [
        migrations.AddField(
            model_name="meal",
            name="source_url",
            field=models.URLField(blank=True, max_length=2048),
        ),
    ]
