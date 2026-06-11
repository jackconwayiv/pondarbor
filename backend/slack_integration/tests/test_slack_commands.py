import hashlib
import hmac
from datetime import date
from unittest import mock
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.test.utils import override_settings

from quotes.models import Quote, QuoteLabel
from slack_integration.models import SlackIdentity
from songaday.models import SongPrompt

User = get_user_model()


def _slack_sig(*, secret: str, timestamp: str, body: bytes) -> str:
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return f"v0={digest}"


def _post_command(*, client: Client, params: dict, secret: str, timestamp: str = "1714060800"):
    raw = urlencode(params).encode("utf-8")
    sig = _slack_sig(secret=secret, timestamp=timestamp, body=raw)
    with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp)):
        return client.post(
            "/api/v1/slack/commands/",
            data=raw,
            content_type="application/x-www-form-urlencoded",
            **{
                "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
                "HTTP_X_SLACK_SIGNATURE": sig,
            },
        )


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SONGADAY_SLACK_PROMPT_TIMEZONE="UTC",
)
class SlackPromptCommandTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_prompt_posts_today_prompt_in_channel(self):
        SongPrompt.objects.create(month=6, day=11, prompt="Songs about rivers")
        with self.settings(SONGADAY_SLACK_PROMPT_TIMEZONE="UTC"):
            with mock.patch(
                "slack_integration.views._today_for_songaday_slack",
                return_value=date(2026, 6, 11),
            ):
                resp = _post_command(
                    client=self.client,
                    secret="test_secret",
                    params={
                        "command": "/prompt",
                        "text": "",
                        "user_id": "U_test",
                        "team_id": "T_test",
                    },
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "in_channel")
        self.assertEqual(data["text"], "Song-a-Day Prompt for 06/11: '*Songs about rivers*'")

    def test_prompt_ephemeral_when_no_prompt_today(self):
        with mock.patch(
            "slack_integration.views._today_for_songaday_slack",
            return_value=date(2026, 6, 11),
        ):
            resp = _post_command(
                client=self.client,
                secret="test_secret",
                params={
                    "command": "/prompt",
                    "text": "",
                    "user_id": "U_test",
                    "team_id": "T_test",
                },
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "ephemeral")
        self.assertIn("no Song-a-day prompt", data["text"])

    def test_unknown_command_is_ephemeral(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/other",
                "text": "",
                "user_id": "U_test",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["response_type"], "ephemeral")
        self.assertEqual(resp.json()["text"], "Unknown command.")

    def test_invalid_signature_forbidden(self):
        raw = urlencode({"command": "/prompt", "user_id": "U_test", "team_id": "T_test"}).encode("utf-8")
        resp = self.client.post(
            "/api/v1/slack/commands/",
            data=raw,
            content_type="application/x-www-form-urlencoded",
            HTTP_X_SLACK_REQUEST_TIMESTAMP="1714060800",
            HTTP_X_SLACK_SIGNATURE="v0=bad",
        )
        self.assertEqual(resp.status_code, 403)


@override_settings(SLACK_SIGNING_SECRET="test_secret")
class SlackQuoteCommandTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        SlackIdentity.objects.create(
            team_id="T_test",
            slack_user_id="U_alice",
            user=self.user,
        )

    def test_quote_saves_with_attribution(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/quote",
                "text": "here's my quote -billy",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "ephemeral")
        self.assertIn("billy", data["text"])

        quote = Quote.objects.get(owner=self.user)
        self.assertEqual(quote.body, "here's my quote")
        self.assertEqual(quote.visibility, Quote.Visibility.PRIVATE)
        labels = list(quote.labels.all())
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels[0].kind, QuoteLabel.Kind.ATTRIBUTION)
        self.assertEqual(labels[0].name, "billy")

    def test_quote_without_attribution(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/quote",
                "text": "plain quote",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        quote = Quote.objects.get(owner=self.user)
        self.assertEqual(quote.body, "plain quote")
        self.assertEqual(quote.labels.count(), 0)

    def test_quote_empty_text_ephemeral(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/quote",
                "text": "",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["response_type"], "ephemeral")
        self.assertIn("Add quote text", resp.json()["text"])
        self.assertEqual(Quote.objects.count(), 0)


@override_settings(SLACK_SIGNING_SECRET="test_secret")
class SlackRandomQuoteCommandTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.owner = User.objects.create_user(email="pub@example.com", password="secret12345")
        self.owner.account_status = User.AccountStatus.APPROVED
        self.owner.username = "pub_user"
        self.owner.save(update_fields=["account_status", "username"])
        Quote.objects.create(
            owner=self.owner,
            body="Slack random quote",
            visibility=Quote.Visibility.PUBLISHED,
        )

    def test_randomquote_posts_in_channel(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/randomquote",
                "text": "",
                "user_id": "U_anyone",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "in_channel")
        self.assertIn("Slack random quote", data["text"])

    def test_randomquote_ephemeral_when_empty_pool(self):
        Quote.objects.all().delete()
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/randomquote",
                "text": "",
                "user_id": "U_anyone",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["response_type"], "ephemeral")
        self.assertIn("No published quotes", resp.json()["text"])


