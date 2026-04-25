from django.conf import settings
from django.db import models


class SlackIdentity(models.Model):
    """Maps a Slack workspace member to a PondArbor user (filled on first /song or admin)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="slack_identities",
    )
    team_id = models.CharField(max_length=32, db_index=True)
    slack_user_id = models.CharField(max_length=32, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("team_id", "slack_user_id"),
                name="slack_integration_slackidentity_team_slack_user_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.team_id}:{self.slack_user_id} -> {self.user_id}"


class SongadaySlackDailyPromptState(models.Model):
    """
    Singleton row (pk=1): last calendar date (in configured TZ) we posted the Song-a-day
    prompt to Slack.
    """

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    last_posted_on = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Song-a-day Slack daily prompt state"

    def __str__(self) -> str:
        return f"SongadaySlackDailyPromptState(last_posted_on={self.last_posted_on!r})"


class SlackEventReceipt(models.Model):
    """Deduplicate Slack Events API retries by `event_id`."""

    event_id = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"SlackEventReceipt(event_id={self.event_id!r})"
