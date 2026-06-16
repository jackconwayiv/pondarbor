from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("recommendations", "0003_destinations_emoji"),
    ]

    operations = [
        migrations.AddField(
            model_name="entry",
            name="creator",
            field=models.CharField(blank=True, max_length=256),
        ),
        migrations.AddField(
            model_name="entry",
            name="media_source",
            field=models.CharField(blank=True, max_length=256),
        ),
    ]
