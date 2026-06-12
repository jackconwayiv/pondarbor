import hashlib
import hmac
import json
from unittest import mock
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.test.utils import override_settings

from contact.models import ContactMessage
from friends.models import FriendRequest
from slack_integration.models import SlackIdentity
from users.models import Profile
from whatif.models import WhatIfQuestion

User = get_user_model()


def _slack_sig(*, secret: str, timestamp: str, body: bytes) -> str:
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return f"v0={digest}"


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
)
class SlackFriendInteractionTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.alice.account_status = User.AccountStatus.APPROVED
        self.alice.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.alice, defaults={"display_name": "Alice"})

        self.bob = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.bob.account_status = User.AccountStatus.APPROVED
        self.bob.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.bob, defaults={"display_name": "Bob"})
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_bob", user=self.bob)

        FriendRequest.objects.create(requester=self.alice, requested=self.bob)

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_friends_accept_button_accepts_request(self, mock_confirm):
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_bob"},
            "actions": [{"action_id": "friends_accept", "value": str(self.alice.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            FriendRequest.objects.filter(
                requester=self.alice, requested=self.bob, is_accepted=True
            ).exists()
        )
        mock_confirm.assert_called_once()

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_friends_decline_button_removes_request(self, mock_confirm):
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_bob"},
            "actions": [{"action_id": "friends_decline", "value": str(self.alice.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(FriendRequest.objects.filter(requester=self.alice, requested=self.bob).exists())
        mock_confirm.assert_called_once()


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
)
class SlackStaffInteractionTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            email="staff@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.staff.account_status = User.AccountStatus.APPROVED
        self.staff.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_staff", user=self.staff)

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_staff_approve_member(self, mock_confirm):
        pending = User.objects.create_user(email="pending@example.com", password="secret12345")
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_staff"},
            "actions": [{"action_id": "staff_approve_member", "value": str(pending.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.account_status, User.AccountStatus.APPROVED)
        mock_confirm.assert_called_once()

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_staff_reject_member(self, mock_confirm):
        pending = User.objects.create_user(email="reject@example.com", password="secret12345")
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_staff"},
            "actions": [{"action_id": "staff_reject_member", "value": str(pending.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.account_status, User.AccountStatus.REJECTED)
        mock_confirm.assert_called_once()

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_staff_whatif_approve(self, mock_confirm):
        q = WhatIfQuestion.objects.create(
            prompt="What if {subject} danced?",
            answer_1="1",
            answer_2="2",
            answer_3="3",
            answer_4="4",
            answer_5="5",
            answer_6="6",
            review_status=WhatIfQuestion.ReviewStatus.PENDING,
            is_active=False,
        )
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_staff"},
            "actions": [{"action_id": "staff_whatif_approve", "value": str(q.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        q.refresh_from_db()
        self.assertEqual(q.review_status, WhatIfQuestion.ReviewStatus.APPROVED)
        self.assertTrue(q.is_active)
        mock_confirm.assert_called_once()

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_staff_contact_ack(self, mock_confirm):
        sender = User.objects.create_user(email="sender@example.com", password="secret12345")
        cm = ContactMessage.objects.create(from_user=sender, message="Help please")
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_staff"},
            "actions": [{"action_id": "staff_contact_ack", "value": str(cm.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        cm.refresh_from_db()
        self.assertIsNotNone(cm.read_at)
        self.assertEqual(cm.read_by_id, self.staff.id)
        mock_confirm.assert_called_once()

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_non_staff_cannot_approve_member(self, mock_confirm):
        member = User.objects.create_user(email="member@example.com", password="secret12345")
        member.account_status = User.AccountStatus.APPROVED
        member.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_member", user=member)
        pending = User.objects.create_user(email="still@example.com", password="secret12345")
        payload = {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": "U_member"},
            "actions": [{"action_id": "staff_approve_member", "value": str(pending.id)}],
        }
        resp = _post_interaction(client=self.client, payload=payload, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.account_status, User.AccountStatus.PENDING)
        mock_confirm.assert_called_once()
        self.assertIn("Staff access required", mock_confirm.call_args.kwargs["text"])
