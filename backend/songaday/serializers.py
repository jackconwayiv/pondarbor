import re
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from rest_framework import serializers

from songaday.models import SongResponse

User = get_user_model()

_ALLOWED_URL_HOST_SUFFIXES = (
    "youtube.com",
    "youtu.be",
    "music.youtube.com",
    "open.spotify.com",
    "spotify.com",
    "spotify.link",
    "music.apple.com",
    "geo.music.apple.com",
)


def _host_allowed(url: str) -> bool:
    raw = (url or "").strip()
    if not raw:
        return True
    try:
        p = urlparse(raw)
    except Exception:
        return False
    host = (p.netloc or "").lower().split("@")[-1]
    if host.startswith("www."):
        host = host[4:]
    return any(host == s or host.endswith("." + s) for s in _ALLOWED_URL_HOST_SUFFIXES)


_YOUTUBE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{6,32}$")


def _validate_youtube_video_id(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    if not _YOUTUBE_ID_RE.fullmatch(v):
        raise serializers.ValidationError("Invalid YouTube video id.")
    return v


def user_row_for_songaday(user: User) -> dict:
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
        "avatar_url": (profile.avatar_url or "") if profile else "",
    }


class SongResponseReadSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    heart_count = serializers.IntegerField(read_only=True)
    viewer_has_hearted = serializers.BooleanField(read_only=True)

    class Meta:
        model = SongResponse
        fields = [
            "id",
            "user",
            "prompt_id",
            "entry_date",
            "prompt_snapshot",
            "notes",
            "artist",
            "title",
            "raw_label",
            "youtube_video_id",
            "spotify_url",
            "apple_music_url",
            "edited",
            "created_at",
            "updated_at",
            "heart_count",
            "viewer_has_hearted",
        ]

    def get_user(self, obj: SongResponse) -> dict:
        return user_row_for_songaday(obj.user)


class SongResponseCreateSerializer(serializers.Serializer):
    entry_date = serializers.DateField()
    prompt_snapshot = serializers.CharField(max_length=20000)
    notes = serializers.CharField(max_length=10000, required=False, allow_blank=True)
    artist = serializers.CharField(max_length=512, required=False, allow_blank=True)
    title = serializers.CharField(max_length=512, required=False, allow_blank=True)
    raw_label = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    youtube_video_id = serializers.CharField(max_length=32, required=False, allow_blank=True)
    spotify_url = serializers.CharField(max_length=1024, required=False, allow_blank=True)
    apple_music_url = serializers.CharField(max_length=1024, required=False, allow_blank=True)

    def validate_youtube_video_id(self, value):
        return _validate_youtube_video_id(value)

    def validate_spotify_url(self, value):
        v = (value or "").strip()
        if v and not _host_allowed(v):
            raise serializers.ValidationError("Spotify URL host is not allowed.")
        return v

    def validate_apple_music_url(self, value):
        v = (value or "").strip()
        if v and not _host_allowed(v):
            raise serializers.ValidationError("Apple Music URL host is not allowed.")
        return v

    def validate(self, attrs):
        def nz(key: str) -> str:
            return (attrs.get(key) or "").strip()

        if not any(
            [
                nz("youtube_video_id"),
                nz("spotify_url"),
                nz("apple_music_url"),
                nz("raw_label"),
                nz("artist"),
                nz("title"),
            ]
        ):
            raise serializers.ValidationError(
                "Add at least a YouTube id, a streaming link, artist/title, or a label.",
            )
        return attrs

    def create(self, validated_data):
        raise NotImplementedError


class SongResponsePatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongResponse
        fields = [
            "notes",
            "artist",
            "title",
            "raw_label",
            "youtube_video_id",
            "spotify_url",
            "apple_music_url",
        ]

    def validate_youtube_video_id(self, value):
        return _validate_youtube_video_id(value)

    def validate_spotify_url(self, value):
        v = (value or "").strip()
        if v and not _host_allowed(v):
            raise serializers.ValidationError("Spotify URL host is not allowed.")
        return v

    def validate_apple_music_url(self, value):
        v = (value or "").strip()
        if v and not _host_allowed(v):
            raise serializers.ValidationError("Apple Music URL host is not allowed.")
        return v

    def update(self, instance, validated_data):
        if validated_data:
            instance.edited = True
        return super().update(instance, validated_data)
