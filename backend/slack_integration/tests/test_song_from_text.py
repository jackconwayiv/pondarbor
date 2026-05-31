import hashlib
import hmac
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings

from slack_integration.models import SlackSongadayIngestTrace
from slack_integration.song_from_text import extract_slack_message_notes
from songaday.models import SongPrompt, SongResponse

User = get_user_model()

SPOTIFY_URL = (
    "https://open.spotify.com/track/1wQXj5bgxyZQ2XmE2X9s6n?si=EX5OZj6-TPyICNJgWdZCNg"
)
EXAMPLE_MESSAGE = (
    f"Hidden track on X&amp;Y! Do those exist anymore :thinking_face: "
    f"<{SPOTIFY_URL}|{SPOTIFY_URL}>"
)


def _slack_sig(*, secret: str, timestamp: str, body: bytes) -> str:
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return f"v0={digest}"


def _post_events_request(*, client, body: dict, secret: str, timestamp: str):
    raw = json.dumps(body).encode("utf-8")
    sig = _slack_sig(secret=secret, timestamp=timestamp, body=raw)
    return client.post(
        "/api/v1/slack/events/",
        data=raw,
        content_type="application/json",
        **{
            "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
            "HTTP_X_SLACK_SIGNATURE": sig,
        },
    )


class ExtractSlackMessageNotesTests(TestCase):
    def test_example_comment_with_html_entity_and_emoji(self):
        notes = extract_slack_message_notes(EXAMPLE_MESSAGE, url=SPOTIFY_URL)
        self.assertEqual(notes, "Hidden track on X&Y! Do those exist anymore 🤔")

    def test_url_only_message_has_empty_notes(self):
        self.assertEqual(extract_slack_message_notes(f"<{SPOTIFY_URL}|Spotify>", url=SPOTIFY_URL), "")
        self.assertEqual(extract_slack_message_notes(SPOTIFY_URL, url=SPOTIFY_URL), "")

    def test_html_entity_without_emoji(self):
        notes = extract_slack_message_notes("Rock &amp; roll forever", url="")
        self.assertEqual(notes, "Rock & roll forever")

    def test_unknown_custom_emoji_is_stripped(self):
        notes = extract_slack_message_notes("Love this :blob_dance: pick", url="")
        self.assertEqual(notes, "Love this pick")

    def test_text_after_url_is_preserved(self):
        text = f"<https://youtu.be/abc123|YouTube> such a vibe"
        notes = extract_slack_message_notes(text, url="https://youtu.be/abc123")
        self.assertEqual(notes, "such a vibe")

    def test_user_mention_is_removed(self):
        text = f"for <@U123> <https://youtu.be/abc123|link>"
        notes = extract_slack_message_notes(text, url="https://youtu.be/abc123")
        self.assertEqual(notes, "for")


class SlackIngestNotesIntegrationTests(TestCase):
    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
        SONGADAY_SLACK_PROMPT_TIMEZONE="UTC",
    )
    def test_saved_channel_message_stores_notes(self):
        user = User.objects.create_user(
            email="notes@example.com",
            password="pw",
            account_status=User.AccountStatus.APPROVED,
        )
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).date()
        SongPrompt.objects.create(month=today.month, day=today.day, prompt="Test prompt")

        body = {
            "team_id": "T1",
            "event_id": "Ev_notes",
            "type": "event_callback",
            "event": {
                "type": "message",
                "channel": "C_songaday",
                "user": "U_slack",
                "text": EXAMPLE_MESSAGE,
            },
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views._resolve_user_for_slack", return_value=(user, None)),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}),
            mock.patch(
                "slack_integration.song_from_text.resolve_song_link_metadata",
                return_value=("Artist", "Title", "spotify"),
            ),
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")

        trace = SlackSongadayIngestTrace.objects.get(event_id="Ev_notes")
        self.assertEqual(trace.outcome, SlackSongadayIngestTrace.Outcome.saved)
        row = SongResponse.objects.get(id=trace.song_response_id)
        self.assertEqual(row.notes, "Hidden track on X&Y! Do those exist anymore 🤔")
