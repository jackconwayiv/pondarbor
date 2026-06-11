from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0017_profile_avatar_image_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="home_starred_app_paths",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
