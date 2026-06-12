import hashlib
import hmac
import json
from datetime import timedelta
from unittest import mock
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from slack_integration.models import SlackDmQueueItem, SlackDmState, SlackIdentity
from slack_integration.dm_digest import build_digest_blocks, flush_due_digests

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
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_DM_THROTTLE_ENABLED=True,
    SLACK_DM_THROTTLE_HOURS=24,
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class SlackDmThrottleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_alice", user=self.user)

        self.other = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.other.account_status = User.AccountStatus.APPROVED
        self.other.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_bob", user=self.other)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_first_proactive_sends_immediately(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        resp = notify_pondarbor_user_dm(self.user, text="Hello", blocks=[{"type": "section"}])
        self.assertTrue(resp.get("ok"))
        mock_send.assert_called()
        state = SlackDmState.objects.get(user=self.user)
        self.assertIsNotNone(state.last_proactive_sent_at)
        self.assertEqual(SlackDmQueueItem.objects.filter(user=self.user).count(), 0)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_staff_user_always_sends_immediately(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now(),
        )
        resp = notify_pondarbor_user_dm(
            self.user,
            text="Staff alert",
            blocks=[],
            feature="staff",
        )
        self.assertTrue(resp.get("ok"))
        self.assertNotIn("queued", resp)
        mock_send.assert_called_once()
        self.assertEqual(SlackDmQueueItem.objects.filter(user=self.user).count(), 0)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_second_proactive_within_window_queues(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now() - timedelta(hours=1),
        )
        resp = notify_pondarbor_user_dm(self.user, text="Queued", blocks=[])
        self.assertTrue(resp.get("queued"))
        mock_send.assert_not_called()
        self.assertEqual(SlackDmQueueItem.objects.filter(user=self.user, sent_at__isnull=True).count(), 1)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_proactive_after_window_merges_pending_batch(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now() - timedelta(hours=25),
        )
        SlackDmQueueItem.objects.create(
            user=self.user,
            feature="closet",
            text="Old item",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "Old"}}],
        )
        notify_pondarbor_user_dm(self.user, text="New item", blocks=[])
        self.assertEqual(mock_send.call_count, 1)
        merged_text = mock_send.call_args.kwargs.get("text") or mock_send.call_args.args[1]
        self.assertIn("digest", merged_text.lower())
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.user, sent_at__isnull=True).exists())

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_proactive_flushes_overdue_batch_for_other_user(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        SlackDmState.objects.create(
            user=self.other,
            last_proactive_sent_at=timezone.now() - timedelta(hours=30),
        )
        SlackDmQueueItem.objects.create(
            user=self.other,
            feature="friends",
            text="Friend request",
            blocks=[],
        )
        notify_pondarbor_user_dm(self.user, text="For alice", blocks=[])
        self.assertGreaterEqual(mock_send.call_count, 2)
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.other, sent_at__isnull=True).exists())

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_immediate_rate_bypasses_throttle(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now() - timedelta(hours=1),
        )
        notify_pondarbor_user_dm(self.user, text="Immediate", rate="immediate")
        mock_send.assert_called_once()
        self.assertEqual(SlackDmQueueItem.objects.filter(user=self.user).count(), 0)

    @override_settings(SLACK_DM_THROTTLE_ENABLED=False)
    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_throttle_disabled_sends_every_time(self, mock_send):
        mock_send.return_value = {"ok": True}
        from slack_integration.notify import notify_pondarbor_user_dm

        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now(),
        )
        notify_pondarbor_user_dm(self.user, text="One", blocks=[])
        notify_pondarbor_user_dm(self.user, text="Two", blocks=[])
        self.assertEqual(mock_send.call_count, 2)
        self.assertEqual(SlackDmQueueItem.objects.count(), 0)

    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_flush_due_digests_site_wide(self, mock_send):
        mock_send.return_value = {"ok": True}
        SlackDmState.objects.create(
            user=self.other,
            last_proactive_sent_at=timezone.now() - timedelta(hours=30),
        )
        SlackDmQueueItem.objects.create(
            user=self.other,
            feature="staff",
            text="Staff alert",
            blocks=[],
        )
        sent = flush_due_digests()
        self.assertEqual(sent, 1)
        mock_send.assert_called_once()
        self.assertFalse(SlackDmQueueItem.objects.filter(user=self.other, sent_at__isnull=True).exists())

    def test_build_digest_blocks_includes_header(self):
        class Item:
            text = "Alert"
            blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": "Alert"}}]

        text, blocks = build_digest_blocks(items=[Item()])
        self.assertIn("digest", text.lower())
        self.assertTrue(any(b.get("type") == "section" for b in blocks))


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_DM_THROTTLE_ENABLED=True,
    SLACK_DM_THROTTLE_HOURS=24,
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class SlackSlashFlushTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_alice", user=self.user)

    @mock.patch("slack_integration.closet_commands.notify_pondarbor_user_dm")
    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_slash_quote_triggers_site_wide_flush(self, mock_send, mock_closet_notify):
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
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={"command": "/quote", "text": "hi -me", "user_id": "U_alice", "team_id": "T_test"},
        )
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called()
        mock_closet_notify.assert_not_called()
        self.assertFalse(SlackDmQueueItem.objects.filter(user=other, sent_at__isnull=True).exists())

    @mock.patch("slack_integration.closet_commands.notify_pondarbor_user_dm")
    @mock.patch("slack_integration.notify._send_slack_dm_now")
    def test_closet_sends_separate_dm_from_digest(self, mock_send, mock_notify):
        mock_send.return_value = {"ok": True}
        mock_notify.return_value = {"ok": True}
        SlackDmState.objects.create(
            user=self.user,
            last_proactive_sent_at=timezone.now() - timedelta(hours=30),
        )
        SlackDmQueueItem.objects.create(
            user=self.user,
            feature="closet",
            text="Pending borrow",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "Pending borrow"}}],
        )
        resp = _post_command(
            client=self.client,
            secret="test_secret",
            params={"command": "/closet", "text": "", "user_id": "U_alice", "team_id": "T_test"},
        )
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called()
        mock_notify.assert_called_once()
        closet_kwargs = mock_notify.call_args.kwargs
        self.assertEqual(closet_kwargs.get("rate"), "immediate")
        digest_call = mock_send.call_args
        digest_text = digest_call.kwargs.get("text") or ""
        self.assertIn("digest", digest_text.lower())
        closet_text = closet_kwargs.get("text") or ""
        self.assertIn("Closet inbox", closet_text)
        self.assertNotIn("digest", closet_text.lower())

    @mock.patch("slack_integration.closet_commands.notify_pondarbor_user_dm")
    def test_slash_closet_does_not_create_queue_item(self, mock_notify):
        mock_notify.return_value = {"ok": True}
        _post_command(
            client=self.client,
            secret="test_secret",
            params={"command": "/closet", "text": "", "user_id": "U_alice", "team_id": "T_test"},
        )
        self.assertEqual(SlackDmQueueItem.objects.count(), 0)
