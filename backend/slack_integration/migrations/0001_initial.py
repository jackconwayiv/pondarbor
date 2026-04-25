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
            name="SongadaySlackDailyPromptState",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("last_posted_on", models.DateField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Song-a-day Slack daily prompt state",
            },
        ),
        migrations.CreateModel(
            name="SlackIdentity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("team_id", models.CharField(db_index=True, max_length=32)),
                ("slack_user_id", models.CharField(db_index=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="slack_identities",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="slackidentity",
            constraint=models.UniqueConstraint(
                fields=("team_id", "slack_user_id"),
                name="slack_integration_slackidentity_team_slack_user_uniq",
            ),
        ),
    ]
