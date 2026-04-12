import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SongPrompt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("month", models.PositiveSmallIntegerField()),
                ("day", models.PositiveSmallIntegerField()),
                ("prompt", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["month", "day"],
            },
        ),
        migrations.CreateModel(
            name="SongResponse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entry_date", models.DateField(db_index=True)),
                ("prompt_snapshot", models.TextField()),
                ("notes", models.TextField(blank=True)),
                ("artist", models.CharField(blank=True, max_length=512)),
                ("title", models.CharField(blank=True, max_length=512)),
                ("raw_label", models.TextField(blank=True)),
                ("youtube_video_id", models.CharField(blank=True, max_length=32)),
                ("spotify_url", models.URLField(blank=True, max_length=1024)),
                ("apple_music_url", models.URLField(blank=True, max_length=1024)),
                ("edited", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "prompt",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responses",
                        to="songaday.songprompt",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="songaday_responses",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-entry_date", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SongResponseHeart",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "response",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hearts",
                        to="songaday.songresponse",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="songaday_hearts_given",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="songprompt",
            constraint=models.UniqueConstraint(fields=("month", "day"), name="uniq_songprompt_month_day"),
        ),
        migrations.AddConstraint(
            model_name="songresponse",
            constraint=models.UniqueConstraint(fields=("user", "entry_date"), name="uniq_songresponse_user_entry_date"),
        ),
        migrations.AddConstraint(
            model_name="songresponseheart",
            constraint=models.UniqueConstraint(fields=("response", "user"), name="uniq_songresponseheart_response_user"),
        ),
    ]
