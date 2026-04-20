from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0033_monster_template_descriptions"),
    ]

    operations = [
        migrations.AddField(
            model_name="roombroadcast",
            name="log_tone",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
    ]
