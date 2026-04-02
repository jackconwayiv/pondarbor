from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_profile_birth_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="whatif_completed_session",
            field=models.BooleanField(default=False),
        ),
    ]
