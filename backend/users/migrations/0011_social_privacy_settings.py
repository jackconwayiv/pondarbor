from django.db import migrations, models


def _backfill_social_publish_visibility(apps, schema_editor):
    Profile = apps.get_model("users", "Profile")
    # Ensure existing users get the new default behavior (discoverable by approved users)
    # unless they explicitly change it later.
    Profile.objects.all().update(social_publish_visibility="all_approved")


def _backfill_songaday_visibility_to_all_approved(apps, schema_editor):
    Profile = apps.get_model("users", "Profile")
    # Align Song-a-day default with the new global policy.
    Profile.objects.filter(songaday_visibility="friends_only").update(
        songaday_visibility="all_approved"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0010_profile_songaday_visibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="social_publish_visibility",
            field=models.CharField(
                choices=[
                    ("all_approved", "All approved users"),
                    ("friends_only", "Friends only"),
                ],
                default="all_approved",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="social_read_scope",
            field=models.CharField(
                choices=[
                    ("approved_users", "Approved users"),
                    ("friends_only", "Friends only"),
                ],
                default="approved_users",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="display_to_friends_only",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="profile",
            name="songaday_visibility",
            field=models.CharField(
                choices=[
                    ("private", "Private (only me)"),
                    ("friends_only", "Friends only"),
                    ("all_approved", "All approved users"),
                ],
                default="all_approved",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            _backfill_social_publish_visibility,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RunPython(
            _backfill_songaday_visibility_to_all_approved,
            reverse_code=migrations.RunPython.noop,
        ),
    ]

