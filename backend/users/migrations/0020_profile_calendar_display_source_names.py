from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0019_profile_onboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="calendar_display_source_names",
            field=models.BooleanField(default=False),
        ),
    ]
