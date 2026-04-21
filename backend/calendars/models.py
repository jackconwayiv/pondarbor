from django.conf import settings
from django.db import models
from django.db.models import Q


class CalendarSource(models.Model):
    """A shared calendar feed owned by a user.

    v1 supports `ical` (a Google Calendar "Secret address in iCal format" URL) and
    `manual` (a synthetic per-user source for hand-entered events). The `google_oauth`
    slot is reserved for future work and not accepted by the current API.
    """

    class SourceType(models.TextChoices):
        ICAL = "ical", "iCal URL"
        MANUAL = "manual", "Manual"
        GOOGLE_OAUTH = "google_oauth", "Google OAuth (future)"

    # Chakra palette tokens we already theme with; validated at the serializer layer.
    class Color(models.TextChoices):
        LILYPAD = "lilypad", "Lilypad"
        SKY = "sky", "Sky"
        NAUTICAL = "nautical", "Nautical"
        GRAY = "gray", "Gray"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calendar_sources",
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.ICAL,
    )
    display_name = models.CharField(max_length=120)
    ical_url = models.URLField(max_length=2048, blank=True, default="")
    color = models.CharField(
        max_length=20,
        choices=Color.choices,
        default=Color.LILYPAD,
    )
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_etag = models.CharField(max_length=255, blank=True, default="")
    last_modified_header = models.CharField(max_length=255, blank=True, default="")
    last_error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Prevent a user from importing the same iCal URL twice.
            models.UniqueConstraint(
                fields=["owner", "ical_url"],
                condition=~Q(ical_url=""),
                name="uniq_calendar_source_owner_ical_url",
            ),
            # Exactly one `manual` source per user (enforced on creation).
            models.UniqueConstraint(
                fields=["owner", "source_type"],
                condition=Q(source_type="manual"),
                name="uniq_calendar_source_manual_per_owner",
            ),
        ]
        indexes = [
            models.Index(fields=["owner"]),
            models.Index(fields=["is_active", "last_synced_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.display_name} ({self.owner_id})"


class Event(models.Model):
    """A "busy" date range for one user.

    The calendar is intentionally binary: a day is either busy (1+ events) or
    free. We store only dates and (for manual events) an optional title that is
    kept private to the owner; iCal-imported rows store no human-readable text
    at all.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    source = models.ForeignKey(
        CalendarSource,
        on_delete=models.CASCADE,
        related_name="events",
    )
    # VEVENT UID from the ICS feed; "" for manual events. Kept for dedup only,
    # never exposed to the API.
    external_uid = models.CharField(max_length=500, blank=True, default="")
    # Optional, owner-only title for manual events. Forced to "" for any
    # non-manual source (see save()/clean()) so shared-feed text can never be
    # persisted even if upstream parsing changes.
    title = models.CharField(max_length=500, blank=True, default="")
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_uid"],
                condition=~Q(external_uid=""),
                name="uniq_event_source_external_uid",
            ),
            models.CheckConstraint(
                condition=Q(end_date__gte=models.F("start_date")),
                name="event_end_date_after_start_date",
            ),
        ]
        indexes = [
            models.Index(fields=["owner", "start_date"]),
            models.Index(fields=["source", "start_date"]),
        ]
        ordering = ["start_date", "id"]

    def clean(self) -> None:
        super().clean()
        if self.source_id and self.source.source_type != CalendarSource.SourceType.MANUAL:
            self.title = ""

    def save(self, *args, **kwargs) -> None:
        # Defense-in-depth: even if a future code path bypasses the serializer,
        # never persist a non-empty title for a non-manual source.
        if self.source_id:
            source_type = (
                self.source.source_type
                if hasattr(self, "_state") and self.source is not None
                else None
            )
            if source_type and source_type != CalendarSource.SourceType.MANUAL:
                self.title = ""
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        label = self.title or "(busy)"
        return f"{label} {self.start_date}–{self.end_date}"
