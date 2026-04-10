from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("meal", "0002_align_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="meal",
            name="title",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
