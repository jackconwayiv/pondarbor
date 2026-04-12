from django.conf import settings
from django.db import models


class SongPrompt(models.Model):
    month = models.PositiveSmallIntegerField()
    day = models.PositiveSmallIntegerField()
    prompt = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["month", "day"], name="uniq_songprompt_month_day"),
        ]
        ordering = ["month", "day"]

    def __str__(self) -> str:
        return f"{self.month:02d}-{self.day:02d}"


class SongResponse(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="songaday_responses",
    )
    prompt = models.ForeignKey(
        SongPrompt,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    entry_date = models.DateField(db_index=True)
    prompt_snapshot = models.TextField()
    notes = models.TextField(blank=True)

    artist = models.CharField(max_length=512, blank=True)
    title = models.CharField(max_length=512, blank=True)
    raw_label = models.TextField(blank=True)

    youtube_video_id = models.CharField(max_length=32, blank=True)
    spotify_url = models.URLField(max_length=1024, blank=True)
    apple_music_url = models.URLField(max_length=1024, blank=True)

    edited = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "entry_date"],
                name="uniq_songresponse_user_entry_date",
            ),
        ]
        ordering = ["-entry_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.user_id} @ {self.entry_date}"


class SongResponseHeart(models.Model):
    response = models.ForeignKey(
        SongResponse,
        on_delete=models.CASCADE,
        related_name="hearts",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="songaday_hearts_given",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["response", "user"],
                name="uniq_songresponseheart_response_user",
            ),
        ]
        ordering = ["-created_at"]
