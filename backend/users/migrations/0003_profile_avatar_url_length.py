from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_profile_timezone_default_phoenix"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="avatar_url",
            field=models.URLField(blank=True, max_length=2048),
        ),
    ]
