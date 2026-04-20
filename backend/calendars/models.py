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
    # VEVENT UID from the ICS feed; null for manual events.
    external_uid = models.CharField(max_length=500, blank=True, default="")
    title = models.CharField(max_length=500)
    location = models.CharField(max_length=500, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    source_timezone = models.CharField(max_length=64, blank=True, default="")
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
                condition=Q(end_at__gte=models.F("start_at")),
                name="event_end_at_after_start_at",
            ),
        ]
        indexes = [
            models.Index(fields=["owner", "start_at"]),
            models.Index(fields=["source", "start_at"]),
        ]
        ordering = ["start_at", "id"]

    def __str__(self) -> str:
        return f"{self.title} @ {self.start_at:%Y-%m-%d %H:%M}"
