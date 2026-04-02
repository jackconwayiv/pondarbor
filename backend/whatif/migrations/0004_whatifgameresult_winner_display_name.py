from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("whatif", "0003_whatifplayer_ready_to_start"),
    ]

    operations = [
        migrations.AddField(
            model_name="whatifgameresult",
            name="winner_display_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
