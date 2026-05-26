from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_remove_display_to_friends_only"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="display_astro",
            field=models.BooleanField(
                default=True,
                help_text="When true, Sun/Moon/Rising appear on the member's friend profile.",
            ),
        ),
    ]
