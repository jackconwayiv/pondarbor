from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import urlparse

from django.utils import timezone
from rest_framework import serializers

from calendars.models import CalendarSource, Event

# Google's iCal secret URL always lives on this host. We intentionally keep the
# allowlist narrow for v1 so we don't accept arbitrary URLs (SSRF guard).
ALLOWED_ICAL_HOSTS = {"calendar.google.com"}

EVENT_TITLE_MAX = 500
EVENT_TEXT_MAX = 20_000
EVENT_LOCATION_MAX = 500


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
        "email": user.email,
        "display_name": display_name,
        "avatar_url": avatar_url,
    }


class CalendarSourceSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()

    class Meta:
        model = CalendarSource
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
    owner = serializers.SerializerMethodField()
    source_display_name = serializers.CharField(source="source.display_name", read_only=True)
    source_type = serializers.CharField(source="source.source_type", read_only=True)
    color = serializers.CharField(source="source.color", read_only=True)
    is_manual = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "owner",
            "source",
            "source_display_name",
            "source_type",
            "color",
            "external_uid",
            "title",
            "location",
            "notes",
            "start_at",
            "end_at",
            "all_day",
            "is_manual",
            "source_timezone",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_owner(self, obj: Event) -> dict:
        return _owner_row(obj.owner)

    def get_is_manual(self, obj: Event) -> bool:
        return obj.source.source_type == CalendarSource.SourceType.MANUAL


class EventWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=EVENT_TITLE_MAX)
    location = serializers.CharField(
        max_length=EVENT_LOCATION_MAX, required=False, allow_blank=True, default=""
    )
    notes = serializers.CharField(
        max_length=EVENT_TEXT_MAX, required=False, allow_blank=True, default=""
    )
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    all_day = serializers.BooleanField(required=False, default=False)

    def validate_title(self, value: str) -> str:
        trimmed = (value or "").strip()
        if not trimmed:
            raise serializers.ValidationError("Title is required.")
        return trimmed

    def validate(self, attrs):
        start = attrs["start_at"]
        end = attrs["end_at"]
        if timezone.is_naive(start):
            start = timezone.make_aware(start, timezone.utc)
            attrs["start_at"] = start
        if timezone.is_naive(end):
            end = timezone.make_aware(end, timezone.utc)
            attrs["end_at"] = end
        if end <= start:
            raise serializers.ValidationError({"end_at": "End must be after start."})
        # Sanity guard: no single event spans more than one year.
        if end - start > timedelta(days=366):
            raise serializers.ValidationError(
                {"end_at": "Event cannot span more than a year."}
            )
        if attrs.get("all_day"):
            # All-day events should be day-aligned; the client is responsible for the
            # exact day math but we reject anything that isn't midnight-to-midnight UTC
            # so search and rendering stay consistent.
            for field_name in ("start_at", "end_at"):
                value: datetime = attrs[field_name]
                if not (
                    value.hour == 0
                    and value.minute == 0
                    and value.second == 0
                    and value.microsecond == 0
                ):
                    raise serializers.ValidationError(
                        {field_name: "All-day events must start and end at midnight UTC."}
                    )
        return attrs
