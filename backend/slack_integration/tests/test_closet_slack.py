import hashlib
import hmac
import json
from unittest import mock
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.test.utils import override_settings

from closet.tests.helpers import ClosetTestMixin
from slack_integration.models import SlackIdentity

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


def _post_interaction(*, client: Client, payload: dict, secret: str, timestamp: str = "1714060800"):
    raw = urlencode({"payload": json.dumps(payload)}).encode("utf-8")
    sig = _slack_sig(secret=secret, timestamp=timestamp, body=raw)
    with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp)):
        return client.post(
            "/api/v1/slack/interactions/",
            data=raw,
            content_type="application/x-www-form-urlencoded",
            **{
                "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
                "HTTP_X_SLACK_SIGNATURE": sig,
            },
        )


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_CLOSET_CHANNEL_ID="C_closet",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class SlackClosetCommandTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.create_users()
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)

    @mock.patch("slack_integration.closet_commands.notify_closet_channel_ephemeral")
    def test_closet_command_from_elsewhere_posts_inbox_ephemeral(self, mock_eph):
        mock_eph.return_value = {"ok": True}
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/closet",
                "text": "",
                "user_id": "U_owner",
                "team_id": "T_test",
                "channel_id": "D0123456789",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("closet inbox", resp.json()["text"].lower())
        mock_eph.assert_called_once()
        blocks = mock_eph.call_args.kwargs["blocks"]
        self.assertTrue(any(b.get("type") == "section" for b in blocks))

    @mock.patch("slack_integration.closet_commands.notify_closet_channel_ephemeral")
    def test_closet_command_in_closet_returns_ephemeral_blocks(self, mock_eph):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/closet",
                "text": "",
                "user_id": "U_owner",
                "team_id": "T_test",
                "channel_id": "C_closet",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "ephemeral")
        self.assertIn("Closet inbox", data["text"])
        self.assertTrue(any(b.get("type") == "section" for b in data["blocks"]))
        mock_eph.assert_not_called()

    @mock.patch("slack_integration.closet_commands.notify_closet_channel_ephemeral")
    def test_loans_command_from_elsewhere_posts_summary_ephemeral(self, mock_eph):
        mock_eph.return_value = {"ok": True}
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/loans",
                "text": "",
                "user_id": "U_owner",
                "team_id": "T_test",
                "channel_id": "D0123456789",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("loans summary", resp.json()["text"].lower())
        mock_eph.assert_called_once()


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class SlackClosetInteractionTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.item = self.make_item(owner=self.owner)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_borrower", user=self.borrower)

    @mock.patch("slack_integration.interactions.notify_closet_channel_ephemeral")
    @mock.patch("slack_integration.interactions.schedule_closet_slack_notify")
    def test_approve_button_approves_request(self, mock_schedule, mock_confirm):
        row = self.make_request(item=self.item, requester=self.borrower)
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_owner"},
            "actions": [{"action_id": "closet_approve", "value": str(row.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, "approved")
        mock_confirm.assert_called()
        mock_schedule.assert_called()

    @mock.patch("slack_integration.interactions.notify_closet_channel_ephemeral")
    def test_decline_button_declines_request(self, mock_confirm):
        row = self.make_request(item=self.item, requester=self.borrower)
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_owner"},
            "actions": [{"action_id": "closet_decline", "value": str(row.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, "declined")
        mock_confirm.assert_called()

    def test_invalid_signature_forbidden(self):
        raw = urlencode({"payload": json.dumps({"type": "block_actions"})}).encode("utf-8")
        resp = self.client.post(
            "/api/v1/slack/interactions/",
            data=raw,
            content_type="application/x-www-form-urlencoded",
            HTTP_X_SLACK_REQUEST_TIMESTAMP="1714060800",
            HTTP_X_SLACK_SIGNATURE="v0=bad",
        )
        self.assertEqual(resp.status_code, 403)


@override_settings(
    SLACK_CLOSET_CHANNEL_ID="C_closet",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
    SLACK_BOT_TOKEN="xoxb-test",
)
class ClosetChannelEphemeralNotifyTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)

    @mock.patch("slack_integration.notify.slack_chat_post_ephemeral", return_value={"ok": True})
    def test_posts_ephemeral_to_closet_channel(self, mock_eph):
        from slack_integration.notify import notify_closet_channel_ephemeral

        notify_closet_channel_ephemeral(
            self.owner,
            text="Hello",
            blocks=[{"type": "section"}],
        )
        mock_eph.assert_called_once()
        self.assertEqual(mock_eph.call_args.kwargs["channel"], "C_closet")
        self.assertEqual(mock_eph.call_args.kwargs["user"], "U_owner")
        self.assertEqual(mock_eph.call_args.kwargs["text"], "Hello")
