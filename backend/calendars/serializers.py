from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlparse

from rest_framework import serializers

from calendars.models import CalendarSource, Event

# Google's iCal secret URL always lives on this host. We intentionally keep the
# allowlist narrow for v1 so we don't accept arbitrary URLs (SSRF guard).
ALLOWED_ICAL_HOSTS = {"calendar.google.com"}

EVENT_TITLE_MAX = 500
# Hard cap to keep "you forgot to set an end date" mistakes from blocking
# enormous swaths of the calendar.
EVENT_MAX_RANGE_DAYS = 366


def _owner_row(user) -> dict:
    profile = getattr(user, "profile", None)
    display_name = ""
    avatar_url = ""
    if profile is not None:
        display_name = (profile.display_name or "").strip()
        avatar_url = (profile.avatar_url or "").strip()
    if not display_name:
        display_name = (user.email or "").split("@")[0]
    return {
        "id": user.id,
        "display_name": display_name,
        "avatar_url": avatar_url,
    }


class CalendarSourceSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()

    class Meta:
        model = CalendarSource
        # ical_url, last_etag, and last_modified_header are intentionally
        # excluded; they're feed-internal metadata that the frontend doesn't
        # need and we don't want to expose.
        fields = (
            "id",
            "owner",
            "source_type",
            "display_name",
            "color",
            "is_active",
            "last_synced_at",
            "last_error",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner",
            "source_type",
            "last_synced_at",
            "last_error",
            "created_at",
            "updated_at",
        )

    def get_owner(self, obj: CalendarSource) -> dict:
        return _owner_row(obj.owner)


class CalendarSourceCreateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=120)
    ical_url = serializers.URLField(max_length=2048)
    color = serializers.ChoiceField(
        choices=CalendarSource.Color.choices,
        default=CalendarSource.Color.LILYPAD,
    )

    def validate_ical_url(self, value: str) -> str:
        url = (value or "").strip()
        if not url:
            raise serializers.ValidationError("iCal URL is required.")
        parsed = urlparse(url)
        if parsed.scheme not in ("https",):
            raise serializers.ValidationError("iCal URL must use https.")
        host = (parsed.hostname or "").lower()
        if host not in ALLOWED_ICAL_HOSTS:
            raise serializers.ValidationError(
                "Only Google Calendar iCal URLs are supported in v1 "
                "(host must be calendar.google.com)."
            )
        return url

    def validate_display_name(self, value: str) -> str:
        trimmed = (value or "").strip()
        if not trimmed:
            raise serializers.ValidationError("Display name is required.")
        return trimmed


class EventSerializer(serializers.ModelSerializer):
    """Read serializer for events.

    The shape is deliberately minimal: only what is needed to render a
    busy/free calendar. ``title`` is exposed *only* to the owner of a manual
    event; for any iCal/shared-source row, ``title`` is always ``null`` even
    if a stale value somehow lingers in the database.
    """

    owner = serializers.SerializerMethodField()
    source_type = serializers.CharField(source="source.source_type", read_only=True)
    title = serializers.SerializerMethodField()
    is_manual = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "owner",
            "source_type",
            "is_manual",
            "title",
            "start_date",
            "end_date",
        )
        read_only_fields = fields

    def get_owner(self, obj: Event) -> dict:
        return _owner_row(obj.owner)

    def get_is_manual(self, obj: Event) -> bool:
        return obj.source.source_type == CalendarSource.SourceType.MANUAL

    def get_title(self, obj: Event) -> str | None:
        if obj.source.source_type != CalendarSource.SourceType.MANUAL:
            return None
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        viewer_id = getattr(viewer, "id", None)
        if viewer_id is None or viewer_id != obj.owner_id:
            return None
        return obj.title or ""


class EventWriteSerializer(serializers.Serializer):
    """Write serializer for the manual "Add event" flow.

    Only the manual source accepts writes; iCal-imported events are read-only.
    Times are not collected or stored — the calendar is binary busy/free per
    day.
    """

    title = serializers.CharField(
        max_length=EVENT_TITLE_MAX, required=False, allow_blank=True, default=""
    )
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate_title(self, value: str) -> str:
        return (value or "").strip()

    def validate(self, attrs):
        start = attrs["start_date"]
        end = attrs["end_date"]
        if end < start:
            raise serializers.ValidationError(
                {"end_date": "End date must be on or after start date."}
            )
        if (end - start) > timedelta(days=EVENT_MAX_RANGE_DAYS):
            raise serializers.ValidationError(
                {"end_date": f"Event cannot span more than {EVENT_MAX_RANGE_DAYS} days."}
            )
        return attrs
