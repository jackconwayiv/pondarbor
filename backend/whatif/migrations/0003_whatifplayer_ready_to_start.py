from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("whatif", "0002_session_owner_and_host_secret"),
    ]

    operations = [
        migrations.AddField(
            model_name="whatifplayer",
            name="ready_to_start",
            field=models.BooleanField(default=False),
        ),
    ]
