from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_profile_avatar_url_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="birth_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
