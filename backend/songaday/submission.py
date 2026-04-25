"""Shared Song-a-day submission logic for REST and Slack."""

from django.db import transaction

from achievements.services import evaluate_songaday_month_of_music_for_user
from songaday.models import SongPrompt, SongResponse
from songaday.serializers import SongResponseCreateSerializer


class SongadaySubmissionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@transaction.atomic
def create_song_response_from_validated_data(*, user, data: dict) -> SongResponse:
    """
    ``data`` must be serializer-validated (SongResponseCreateSerializer).
    """
    entry = data["entry_date"]
    prompt = SongPrompt.objects.filter(month=entry.month, day=entry.day).first()
    if prompt is None:
        raise SongadaySubmissionError("There is no prompt for this date.", 400)

    if SongResponse.objects.filter(user_id=user.id, entry_date=entry).exists():
        raise SongadaySubmissionError("You already submitted for this date.", 409)

    row = SongResponse.objects.create(
        user=user,
        prompt=prompt,
        entry_date=entry,
        prompt_snapshot=data["prompt_snapshot"].strip(),
        notes=(data.get("notes") or "").strip(),
        artist=(data.get("artist") or "").strip(),
        title=(data.get("title") or "").strip(),
        raw_label=(data.get("raw_label") or "").strip(),
        youtube_video_id=(data.get("youtube_video_id") or "").strip(),
        spotify_url=(data.get("spotify_url") or "").strip(),
        apple_music_url=(data.get("apple_music_url") or "").strip(),
    )
    evaluate_songaday_month_of_music_for_user(user.id)
    return row


def validate_song_response_payload(data: dict) -> dict:
    ser = SongResponseCreateSerializer(data=data)
    ser.is_valid(raise_exception=True)
    return ser.validated_data
