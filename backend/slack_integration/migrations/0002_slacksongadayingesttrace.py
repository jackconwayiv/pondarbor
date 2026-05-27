from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("slack_integration", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SlackSongadayIngestTrace",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("event_id", models.CharField(blank=True, db_index=True, default="", max_length=128)),
                ("team_id", models.CharField(blank=True, db_index=True, default="", max_length=32)),
                ("channel_id", models.CharField(blank=True, db_index=True, default="", max_length=32)),
                ("slack_user_id", models.CharField(blank=True, db_index=True, default="", max_length=32)),
                ("raw_text", models.CharField(blank=True, default="", max_length=512)),
                ("extracted_url", models.CharField(blank=True, db_index=True, default="", max_length=512)),
                ("song_response_id", models.IntegerField(blank=True, db_index=True, null=True)),
                ("outcome", models.CharField(choices=[("signature_invalid", "Signature invalid"), ("duplicate_event", "Duplicate event"), ("ignored_subtype", "Ignored (subtype)"), ("ignored_bot", "Ignored (bot)"), ("ignored_channel", "Ignored (wrong channel)"), ("no_url", "No URL"), ("unlinked_user", "Unlinked user"), ("pending_approval", "Pending approval"), ("no_prompt_today", "No prompt today"), ("validation_error", "Validation error"), ("already_submitted", "Already submitted"), ("saved", "Saved"), ("exception", "Exception")], db_index=True, max_length=64)),
                ("detail", models.CharField(blank=True, default="", max_length=512)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="slack_songaday_ingest_traces", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]

