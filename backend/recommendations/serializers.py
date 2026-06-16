from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from recommendations.models import Entry, RecommendationCategory, Review
from recommendations.services import format_rating_display, normalize_coordinate, normalize_link, normalize_rating
from users.avatar_url import profile_avatar_url

User = get_user_model()


class CoordinateField(serializers.Field):
    """Accept high-precision lat/lng from geocoders; normalize before model DecimalField limits."""

    def __init__(self, *, kind: str, **kwargs):
        self.kind = kind
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if data is None or data == "":
            return None
        try:
            return normalize_coordinate(data, kind=self.kind)
        except ValueError as e:
            raise serializers.ValidationError(str(e)) from e

    def to_representation(self, value):
        return value


def user_row(user: User) -> dict:
    profile = getattr(user, "profile", None)
    nickname = (
        (profile.display_name or user.email.split("@")[0]).strip()
        if profile
        else user.email.split("@")[0]
    )
    return {
        "id": user.id,
        "email": user.email,
        "nickname": nickname,
        "avatar_url": profile_avatar_url(profile) if profile else "",
    }


class RecommendationCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationCategory
        fields = ["id", "slug", "name", "emoji", "group", "is_preset", "created_at"]


class RecommendationCategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    emoji = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")
    group = serializers.ChoiceField(choices=["places", "media", "links"])

    def validate_name(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Name is required.")
        return v


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.SerializerMethodField()
    rating_display = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "reviewer",
            "rating",
            "rating_display",
            "body",
            "date_recommended",
            "edited_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reviewer", "edited_at", "created_at", "updated_at"]

    def get_reviewer(self, obj):
        return user_row(obj.reviewer)

    def get_rating_display(self, obj):
        return format_rating_display(obj.rating)


class ReviewCreateSerializer(serializers.Serializer):
    rating = serializers.DecimalField(max_digits=4, decimal_places=2)
    body = serializers.CharField()
    date_recommended = serializers.DateField(required=False)

    def validate_rating(self, value):
        try:
            return normalize_rating(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e)) from e

    def validate_body(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Comment is required for your first review.")
        return v


class ReviewPatchSerializer(serializers.Serializer):
    rating = serializers.DecimalField(max_digits=4, decimal_places=2, required=False)
    body = serializers.CharField(required=False, allow_blank=True)

    def validate_rating(self, value):
        if value is None:
            return value
        try:
            return normalize_rating(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e)) from e


class EntryWriteSerializer(serializers.Serializer):
    category_slug = serializers.SlugField()
    title = serializers.CharField(max_length=512)
    link = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    image_url = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    address = serializers.CharField(required=False, allow_blank=True, max_length=512)
    creator = serializers.CharField(required=False, allow_blank=True, max_length=256)
    media_source = serializers.CharField(required=False, allow_blank=True, max_length=256)
    google_place_id = serializers.CharField(required=False, allow_blank=True, max_length=256)
    latitude = CoordinateField(kind="latitude", required=False, allow_null=True)
    longitude = CoordinateField(kind="longitude", required=False, allow_null=True)
    rating = serializers.DecimalField(max_digits=4, decimal_places=2)
    body = serializers.CharField()
    date_recommended = serializers.DateField(required=False)

    def validate_title(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Title is required.")
        return v

    def validate_rating(self, value):
        try:
            return normalize_rating(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e)) from e

    def validate_body(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Comment is required for your first review.")
        return v


class EntryPatchSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=512, required=False)
    link = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    image_url = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    address = serializers.CharField(required=False, allow_blank=True, max_length=512)
    creator = serializers.CharField(required=False, allow_blank=True, max_length=256)
    media_source = serializers.CharField(required=False, allow_blank=True, max_length=256)
    location_label = serializers.CharField(required=False, allow_blank=True, max_length=128)
    google_place_id = serializers.CharField(required=False, allow_blank=True, max_length=256)
    latitude = CoordinateField(kind="latitude", required=False, allow_null=True)
    longitude = CoordinateField(kind="longitude", required=False, allow_null=True)


class EntryListSerializer(serializers.Serializer):
    def to_representation(self, instance: Entry):
        stats = self.context.get("stats") or {}
        row = stats.get(instance.id) or {}
        reviewers = self.context.get("reviewers_by_entry", {}).get(instance.id, [])
        avg = row.get("average_rating")
        return {
            "id": instance.id,
            "category": RecommendationCategorySerializer(instance.category).data,
            "title": instance.title,
            "link": instance.link or "",
            "image_url": instance.image_url or "",
            "creator": instance.creator or "",
            "media_source": instance.media_source or "",
            "address": instance.address or "",
            "location_label": instance.location_label or "",
            "google_place_id": instance.google_place_id or "",
            "latitude": instance.latitude,
            "longitude": instance.longitude,
            "created_by": user_row(instance.created_by),
            "average_rating": float(avg) if avg is not None else None,
            "average_rating_display": format_rating_display(Decimal(str(avg))) if avg is not None else None,
            "review_count": row.get("review_count") or 0,
            "reviewer_avatars": reviewers,
            "last_reviewed_at": row.get("last_reviewed_at"),
            "viewer_review_id": self.context.get("viewer_review_by_entry", {}).get(instance.id),
            "created_at": instance.created_at,
            "updated_at": instance.updated_at,
        }


class EntryDetailSerializer(EntryListSerializer):
    def to_representation(self, instance: Entry):
        base = super().to_representation(instance)
        reviews = self.context.get("reviews") or []
        base["reviews"] = ReviewSerializer(reviews, many=True).data
        return base
