import hashlib
import hmac
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings

from slack_integration.models import SlackEventReceipt, SlackSongadayIngestTrace
from slack_integration.song_from_text import extract_first_slack_url
from songaday.models import SongPrompt, SongResponse

User = get_user_model()


def _slack_sig(*, secret: str, timestamp: str, body: bytes) -> str:
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return f"v0={digest}"


def _post_events_request(*, client, body: dict, secret: str, timestamp: str, sign: bool = True):
    raw = json.dumps(body).encode("utf-8")
    sig = _slack_sig(secret=secret, timestamp=timestamp, body=raw) if sign else "v0=deadbeef"
    return client.post(
        "/api/v1/slack/events/",
        data=raw,
        content_type="application/json",
        **{
            "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
            "HTTP_X_SLACK_SIGNATURE": sig,
        },
    )


class SlackSongadayIngestTraceTests(TestCase):
    @override_settings(SLACK_SIGNING_SECRET="test_secret")
    def test_signature_invalid_creates_trace(self):
        body = {
            "team_id": "T1",
            "event_id": "Ev1",
            "type": "event_callback",
            "event": {"type": "message", "channel": "C1", "user": "U1", "text": "https://example.com"},
        }
        _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800", sign=False)
        row = SlackSongadayIngestTrace.objects.get(event_id="Ev1")
        self.assertEqual(row.outcome, SlackSongadayIngestTrace.Outcome.signature_invalid)
        self.assertEqual(row.team_id, "T1")

    @override_settings(SLACK_SIGNING_SECRET="test_secret", SLACK_PROMPTS_CHANNEL_ID="C_songaday")
    def test_no_url_creates_trace(self):
        body = {
            "team_id": "T1",
            "event_id": "Ev2",
            "type": "event_callback",
            "event": {"type": "message", "channel": "C_songaday", "user": "U1", "text": "hello"},
        }
        with mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")
        row = SlackSongadayIngestTrace.objects.get(event_id="Ev2")
        self.assertEqual(row.outcome, SlackSongadayIngestTrace.Outcome.no_url)

    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
    )
    def test_unlinked_user_creates_trace(self):
        body = {
            "team_id": "T1",
            "event_id": "Ev3",
            "type": "event_callback",
            "event": {"type": "message", "channel": "C_songaday", "user": "U_slack", "text": "https://youtu.be/abc123"},
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views.slack_users_info", return_value={"ok": True, "user": {"profile": {"email": "nope@example.com"}}}),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}),
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")
        row = SlackSongadayIngestTrace.objects.get(event_id="Ev3")
        self.assertEqual(row.outcome, SlackSongadayIngestTrace.Outcome.unlinked_user)
        self.assertEqual(row.extracted_url, "https://youtu.be/abc123")

    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
        SONGADAY_SLACK_PROMPT_TIMEZONE="UTC",
    )
    def test_no_prompt_today_creates_trace_and_ephemeral(self):
        user = User.objects.create_user(email="u@example.com", password="pw", account_status=User.AccountStatus.APPROVED)
        body = {
            "team_id": "T1",
            "event_id": "Ev4",
            "type": "event_callback",
            "event": {"type": "message", "channel": "C_songaday", "user": "U_slack", "text": "https://youtu.be/abc123"},
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views._resolve_user_for_slack", return_value=(user, None)),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}) as post_eph,
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")
        row = SlackSongadayIngestTrace.objects.get(event_id="Ev4")
        self.assertEqual(row.outcome, SlackSongadayIngestTrace.Outcome.no_prompt_today)
        self.assertTrue(post_eph.called)

    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
        SONGADAY_SLACK_PROMPT_TIMEZONE="UTC",
    )
    def test_saved_creates_trace_and_response(self):
        user = User.objects.create_user(email="u2@example.com", password="pw", account_status=User.AccountStatus.APPROVED)
        # Slack handler looks up prompt by month/day of "today" in configured TZ.
        # We pin time.time only for signature window; date comes from datetime.now(tz) (UTC here),
        # so make the prompt for "today" dynamically.
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).date()
        SongPrompt.objects.create(month=today.month, day=today.day, prompt="Test prompt")

        body = {
            "team_id": "T1",
            "event_id": "Ev5",
            "type": "event_callback",
            "event": {"type": "message", "channel": "C_songaday", "user": "U_slack", "text": "https://youtu.be/abc123"},
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views._resolve_user_for_slack", return_value=(user, None)),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}),
            mock.patch("slack_integration.song_from_text.resolve_from_youtube_video_id", return_value=("", "", "youtube")),
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")

        trace = SlackSongadayIngestTrace.objects.get(event_id="Ev5")
        self.assertEqual(trace.outcome, SlackSongadayIngestTrace.Outcome.saved)
        self.assertIsNotNone(trace.song_response_id)
        self.assertTrue(SongResponse.objects.filter(id=trace.song_response_id).exists())
        self.assertTrue(SlackEventReceipt.objects.filter(event_id="Ev5").exists())

    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
        SONGADAY_SLACK_PROMPT_TIMEZONE="UTC",
    )
    def test_saved_slack_wrapped_youtube_url(self):
        user = User.objects.create_user(email="u3@example.com", password="pw", account_status=User.AccountStatus.APPROVED)
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).date()
        SongPrompt.objects.create(month=today.month, day=today.day, prompt="Test prompt")

        body = {
            "team_id": "T1",
            "event_id": "Ev6",
            "type": "event_callback",
            "event": {
                "type": "message",
                "channel": "C_songaday",
                "user": "U_slack",
                "text": "<https://youtu.be/xwvG3ztYfng?si=TW4BZ|YouTube>",
            },
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views._resolve_user_for_slack", return_value=(user, None)),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}),
            mock.patch("slack_integration.song_from_text.resolve_from_youtube_video_id", return_value=("", "", "youtube")),
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")

        trace = SlackSongadayIngestTrace.objects.get(event_id="Ev6")
        self.assertEqual(trace.outcome, SlackSongadayIngestTrace.Outcome.saved)
        self.assertEqual(trace.extracted_url, "https://youtu.be/xwvG3ztYfng?si=TW4BZ")
        self.assertIsNotNone(trace.song_response_id)

    @override_settings(
        SLACK_SIGNING_SECRET="test_secret",
        SLACK_PROMPTS_CHANNEL_ID="C_songaday",
        SLACK_BOT_TOKEN="xoxb-test",
    )
    def test_unlinked_user_extracts_slack_wrapped_spotify_url(self):
        body = {
            "team_id": "T1",
            "event_id": "Ev7",
            "type": "event_callback",
            "event": {
                "type": "message",
                "channel": "C_songaday",
                "user": "U_slack",
                "text": "<https://open.spotify.com/track/7J5tyfg3Oabc|Spotify>",
            },
        }
        with (
            mock.patch("slack_integration.slack_verify.time.time", return_value=1714060800),
            mock.patch("slack_integration.views.slack_users_info", return_value={"ok": True, "user": {"profile": {"email": "nope@example.com"}}}),
            mock.patch("slack_integration.views.slack_chat_post_ephemeral", return_value={"ok": True}),
        ):
            _post_events_request(client=self.client, body=body, secret="test_secret", timestamp="1714060800")
        row = SlackSongadayIngestTrace.objects.get(event_id="Ev7")
        self.assertEqual(row.outcome, SlackSongadayIngestTrace.Outcome.unlinked_user)
        self.assertEqual(row.extracted_url, "https://open.spotify.com/track/7J5tyfg3Oabc")


class ExtractFirstSlackUrlTests(TestCase):
    def test_slack_wrapped_spotify_url(self):
        text = "<https://open.spotify.com/track/7J5tyfg3Oabc|Spotify>"
        self.assertEqual(extract_first_slack_url(text), "https://open.spotify.com/track/7J5tyfg3Oabc")

    def test_slack_wrapped_youtube_with_query(self):
        text = "<https://youtu.be/xwvG3ztYfng?si=TW4BZ>"
        self.assertEqual(extract_first_slack_url(text), "https://youtu.be/xwvG3ztYfng?si=TW4BZ")

    def test_slack_wrapped_youtube_with_label(self):
        text = "<https://youtu.be/abc123?si=xyz|YouTube>"
        self.assertEqual(extract_first_slack_url(text), "https://youtu.be/abc123?si=xyz")

    def test_plain_url(self):
        self.assertEqual(extract_first_slack_url("https://youtu.be/abc123"), "https://youtu.be/abc123")

