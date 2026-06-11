from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0018_profile_home_starred_app_paths"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="onboarding_completed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="profile",
            name="onboarding_step",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
