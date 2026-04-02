from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("whatif", "0005_seed_five_whatif_questions"),
    ]

    operations = [
        migrations.AddField(
            model_name="whatifplayer",
            name="paused",
            field=models.BooleanField(default=False),
        ),
    ]
