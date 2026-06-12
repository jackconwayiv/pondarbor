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
    arborbot_dms_enabled = models.BooleanField(default=False)
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


class SlackSongadayIngestTrace(models.Model):
    """
    Persist a lightweight trace row for each candidate Song-a-Day Slack message event.

    This is intentionally redundant with logs so production debugging can be done in Django admin
    even when logs are hard to access.
    """

    class Outcome(models.TextChoices):
        signature_invalid = "signature_invalid", "Signature invalid"
        duplicate_event = "duplicate_event", "Duplicate event"
        ignored_subtype = "ignored_subtype", "Ignored (subtype)"
        ignored_bot = "ignored_bot", "Ignored (bot)"
        ignored_channel = "ignored_channel", "Ignored (wrong channel)"
        no_url = "no_url", "No URL"
        unlinked_user = "unlinked_user", "Unlinked user"
        pending_approval = "pending_approval", "Pending approval"
        no_prompt_today = "no_prompt_today", "No prompt today"
        validation_error = "validation_error", "Validation error"
        already_submitted = "already_submitted", "Already submitted"
        saved = "saved", "Saved"
        exception = "exception", "Exception"

    created_at = models.DateTimeField(auto_now_add=True)

    # Slack metadata
    event_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    team_id = models.CharField(max_length=32, blank=True, default="", db_index=True)
    channel_id = models.CharField(max_length=32, blank=True, default="", db_index=True)
    slack_user_id = models.CharField(max_length=32, blank=True, default="", db_index=True)

    # Message content / parse
    raw_text = models.CharField(max_length=512, blank=True, default="")
    extracted_url = models.CharField(max_length=512, blank=True, default="", db_index=True)

    # Resolution / result
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="slack_songaday_ingest_traces",
    )
    song_response_id = models.IntegerField(null=True, blank=True, db_index=True)

    outcome = models.CharField(max_length=64, choices=Outcome.choices, db_index=True)
    detail = models.CharField(max_length=512, blank=True, default="")

    def __str__(self) -> str:
        core = f"SlackSongadayIngestTrace(outcome={self.outcome!r}"
        if self.event_id:
            core += f", event_id={self.event_id!r}"
        if self.channel_id:
            core += f", channel_id={self.channel_id!r}"
        if self.slack_user_id:
            core += f", slack_user_id={self.slack_user_id!r}"
        return core + ")"


class SlackDmState(models.Model):
    """Per-user proactive Slack DM throttle state."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="slack_dm_state",
    )
    last_proactive_sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"SlackDmState(user_id={self.user_id}, last_proactive_sent_at={self.last_proactive_sent_at!r})"


class SlackDmQueueItem(models.Model):
    """Queued proactive Slack DM payload (batched into digests)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="slack_dm_queue_items",
    )
    feature = models.CharField(max_length=32)
    event_type = models.CharField(max_length=64, blank=True, default="")
    ref_key = models.CharField(max_length=128, blank=True, default="", db_index=True)
    text = models.TextField()
    blocks = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "sent_at"]),
            models.Index(fields=["event_type", "ref_key", "sent_at"]),
        ]

    def __str__(self) -> str:
        return f"SlackDmQueueItem(user_id={self.user_id}, feature={self.feature!r}, sent_at={self.sent_at!r})"
