import hashlib
import hmac
from datetime import timedelta
from unittest import mock
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from friends.actions import accept_incoming_friend_request
from slack_integration.models import SlackDmQueueItem, SlackDmState, SlackIdentity
from slack_integration.dm_digest import flush_due_digests
from slack_integration.dm_queue import EVENT_FRIENDS_INCOMING, ref_user

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


def _opt_in(user) -> None:
    SlackIdentity.objects.filter(user=user).update(arborbot_dms_enabled=True)


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_DM_THROTTLE_ENABLED=True,
    SLACK_DM_THROTTLE_HOURS=24,
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class PondarborOptInTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.ident = SlackIdentity.objects.create(
            team_id="T_test",
            slack_user_id="U_alice",
            user=self.user,
        )
        self.requester = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.requester.account_status = User.AccountStatus.APPROVED
        self.requester.save(update_fields=["account_status"])

    def test_default_identity_opted_out(self):
        self.assertFalse(self.ident.arborbot_dms_enabled)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_proactive_skipped_and_queued_when_opted_out(self, mock_send):
        from slack_integration.notify import notify_pondarbor_user_dm

        resp = notify_pondarbor_user_dm(
            self.user,
            text="Friend request",
            blocks=[],
            feature="friends",
            event_type=EVENT_FRIENDS_INCOMING,
            ref_key=ref_user(self.requester.id),
        )
        self.assertTrue(resp.get("queued"))
        self.assertEqual(resp.get("skipped"), "dms_opt_out")
        mock_send.assert_not_called()
        row = SlackDmQueueItem.objects.get(user=self.user)
        self.assertEqual(row.event_type, EVENT_FRIENDS_INCOMING)
        self.assertEqual(row.ref_key, ref_user(self.requester.id))

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_proactive_sends_when_opted_in(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        _opt_in(self.user)
        resp = notify_pondarbor_user_dm(self.user, text="Hello", blocks=[])
        self.assertTrue(resp.get("ok"))
        mock_send.assert_called_once()
        self.assertEqual(SlackDmQueueItem.objects.filter(user=self.user).count(), 0)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_immediate_rate_sends_when_opted_out(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        notify_pondarbor_user_dm(self.user, text="Confirmation", rate="immediate")
        mock_send.assert_called_once()

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_pondarbor_on_enables_and_flushes_backlog(self, mock_send):
        mock_send.return_value = {"ok": True}
        SlackDmQueueItem.objects.create(
            user=self.user,
            feature="friends",
            event_type=EVENT_FRIENDS_INCOMING,
            ref_key=ref_user(self.requester.id),
            text="Queued friend request",
            blocks=[],
        )
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/pondarbor",
                "text": "on",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["response_type"], "ephemeral")
        self.assertIn("now on", body["text"].lower())
        self.ident.refresh_from_db()
        self.assertTrue(self.ident.arborbot_dms_enabled)
        mock_send.assert_called()
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.user, sent_at__isnull=True).exists())

    def test_pondarbor_off_disables(self):
        self.ident.arborbot_dms_enabled = True
        self.ident.save(update_fields=["arborbot_dms_enabled"])
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/pondarbor",
                "text": "off",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.ident.refresh_from_db()
        self.assertFalse(self.ident.arborbot_dms_enabled)
        self.assertIn("now off", resp.json()["text"].lower())

    def test_pondarbor_status_hint_when_off(self):
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/pondarbor",
                "text": "",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertIn("OFF", resp.json()["text"])
        self.assertIn("/pondarbor on", resp.json()["text"])

    def test_pondarbor_status_hint_when_on(self):
        self.ident.arborbot_dms_enabled = True
        self.ident.save(update_fields=["arborbot_dms_enabled"])
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/pondarbor",
                "text": "maybe",
                "user_id": "U_alice",
                "team_id": "T_test",
            },
        )
        self.assertIn("ON", resp.json()["text"])
        self.assertIn("/pondarbor off", resp.json()["text"])

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_flush_due_digests_skips_opted_out(self, mock_send):
        mock_send.return_value = {"ok": True}
        other = User.objects.create_user(email="other@example.com", password="secret12345")
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_other", user=other)
        SlackDmState.objects.create(
            user=other,
            last_proactive_sent_at=timezone.now() - timedelta(hours=30),
        )
        SlackDmQueueItem.objects.create(
            user=other,
            feature="closet",
            text="Pending",
            blocks=[],
        )
        sent = flush_due_digests()
        self.assertEqual(sent, 0)
        mock_send.assert_not_called()
        self.assertTrue(SlackDmQueueItem.objects.filter(user=other, sent_at__isnull=True).exists())

    def test_accept_friend_cancels_queued_dm(self):
        from friends.models import FriendRequest

        FriendRequest.objects.create(
            requester=self.requester,
            requested=self.user,
            is_accepted=False,
        )
        SlackDmQueueItem.objects.create(
            user=self.user,
            feature="friends",
            event_type=EVENT_FRIENDS_INCOMING,
            ref_key=ref_user(self.requester.id),
            text="Friend request",
            blocks=[],
        )
        accept_incoming_friend_request(user=self.user, requester_id=self.requester.id)
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.user, sent_at__isnull=True).exists())

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_slack_friends_accept_cancels_queued_dm(self, mock_confirm):
        from friends.models import FriendRequest
        from slack_integration.interactions import _handle_block_actions

        FriendRequest.objects.create(
            requester=self.requester,
            requested=self.user,
            is_accepted=False,
        )
        SlackDmQueueItem.objects.create(
            user=self.user,
            feature="friends",
            event_type=EVENT_FRIENDS_INCOMING,
            ref_key=ref_user(self.requester.id),
            text="Friend request",
            blocks=[],
        )
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_alice"},
            "actions": [{"action_id": "friends_accept", "value": str(self.requester.id)}],
        }
        with mock.patch(
            "slack_integration.interactions._resolve_user_from_payload",
            return_value=self.user,
        ):
            _handle_block_actions(payload)
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.user, sent_at__isnull=True).exists())
        mock_confirm.assert_called_once()
