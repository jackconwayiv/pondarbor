from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0020_profile_calendar_display_source_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="goodreads_user_id",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
