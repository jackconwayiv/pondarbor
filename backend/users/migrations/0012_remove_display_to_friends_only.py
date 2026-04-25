from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0011_social_privacy_settings"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="display_to_friends_only",
        ),
    ]

