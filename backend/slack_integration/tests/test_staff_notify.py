from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone

from slack_integration.models import SlackIdentity
from slack_integration.staff_notify import (
    notify_all_staff,
    notify_staff_new_pending_member,
    notify_staff_whatif_question_proposed,
)
from users.models import Profile
from whatif.models import WhatIfQuestion
from zodiac.models import AstroProfile

User = get_user_model()


@override_settings(
    PONDARBOR_ORIGIN="https://www.pondarbor.com",
    SLACK_STAFF_NOTIFICATIONS_ENABLED=True,
    SLACK_BOT_TOKEN="xoxb-test",
)
class StaffSlackNotifyTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            email="staff@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.staff.account_status = User.AccountStatus.APPROVED
        self.staff.save(update_fields=["account_status"])
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_staff", user=self.staff)

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_notify_all_staff_targets_linked_staff(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        member = User.objects.create_user(email="new@example.com", password="secret12345")
        sent = notify_staff_new_pending_member(user=member)
        self.assertEqual(sent, 1)
        mock_dm.assert_called_once()
        kwargs = mock_dm.call_args.kwargs
        self.assertEqual(kwargs["feature"], "staff")
        self.assertIn("new@example.com", kwargs["text"])
        blocks_str = str(kwargs["blocks"])
        self.assertIn("staff_approve_member", blocks_str)
        self.assertIn("staff_reject_member", blocks_str)
        self.assertIn("/staff", blocks_str)

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_signup_pending_member_notifies_staff(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        with self.captureOnCommitCallbacks(execute=True):
            User.objects.create_user(email="signup@example.com", password="secret12345")
        self.assertEqual(mock_dm.call_count, 1)
        self.assertIn("signup@example.com", mock_dm.call_args.kwargs["text"])

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_staff_user_creation_does_not_self_notify(self, mock_dm):
        with self.captureOnCommitCallbacks(execute=True):
            User.objects.create_user(
                email="newstaff@example.com",
                password="secret12345",
                is_staff=True,
            )
        mock_dm.assert_not_called()

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_zodiac_birth_submit_notifies_staff(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        member = User.objects.create_user(email="zodiac@example.com", password="secret12345")
        member.account_status = User.AccountStatus.APPROVED
        member.save(update_fields=["account_status"])
        client = self.client
        client.force_login(member)
        with self.captureOnCommitCallbacks(execute=True):
            resp = client.put(
                "/api/v1/zodiac/profile/",
                {
                    "birth_date": "1990-05-15",
                    "birth_time": "14:30:00",
                    "locality": "Phoenix",
                    "admin_area": "AZ",
                    "country_code": "US",
                },
                content_type="application/json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(mock_dm.call_count, 1)
        self.assertIn("zodiac@example.com", mock_dm.call_args.kwargs["text"])
        self.assertIn("/staff/zodiac", str(mock_dm.call_args.kwargs["blocks"]))

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_zodiac_resubmit_while_waiting_does_not_spam(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        member = User.objects.create_user(email="zodiac2@example.com", password="secret12345")
        member.account_status = User.AccountStatus.APPROVED
        member.save(update_fields=["account_status"])
        AstroProfile.objects.create(
            user=member,
            chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART,
            birth_date="1990-05-15",
            locality="Phoenix",
            admin_area="AZ",
            country_code="US",
            waiting_submitted_at=timezone.now(),
        )
        client = self.client
        client.force_login(member)
        payload = {
            "birth_date": "1990-05-15",
            "birth_time": "14:30:00",
            "locality": "Phoenix",
            "admin_area": "AZ",
            "country_code": "US",
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = client.put("/api/v1/zodiac/profile/", payload, content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        mock_dm.assert_not_called()

    @override_settings(SLACK_STAFF_NOTIFICATIONS_ENABLED=False)
    def test_disabled_skips_notify(self):
        self.assertEqual(notify_all_staff(text="hi"), 0)

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_whatif_propose_notifies_staff(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        member = User.objects.create_user(email="proposer@example.com", password="secret12345")
        member.account_status = User.AccountStatus.APPROVED
        member.save(update_fields=["account_status"])
        profile = Profile.objects.get(user=member)
        profile.whatif_completed_session = True
        profile.save(update_fields=["whatif_completed_session"])
        client = self.client
        client.force_login(member)
        payload = {
            "prompt": "What if {subject} had to choose?",
            "answer_1": "A",
            "answer_2": "B",
            "answer_3": "C",
            "answer_4": "D",
            "answer_5": "E",
            "answer_6": "F",
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = client.post("/api/v1/whatif/questions/propose/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(mock_dm.call_count, 1)
        kwargs = mock_dm.call_args.kwargs
        self.assertIn("proposer@example.com", kwargs["text"])
        self.assertIn("What if", kwargs["text"])
        blocks_str = str(kwargs["blocks"])
        self.assertIn("staff_whatif_approve", blocks_str)
        self.assertIn("staff_whatif_reject", blocks_str)
        self.assertIn("/whatif/admin", blocks_str)

    @mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm")
    def test_contact_submit_notifies_staff(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        member = User.objects.create_user(email="sender@example.com", password="secret12345")
        member.account_status = User.AccountStatus.APPROVED
        member.save(update_fields=["account_status"])
        client = self.client
        client.force_login(member)
        with self.captureOnCommitCallbacks(execute=True):
            resp = client.post(
                "/api/v1/contact/",
                {"message": "Need help with my account", "website": ""},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(mock_dm.call_count, 1)
        kwargs = mock_dm.call_args.kwargs
        self.assertIn("sender@example.com", kwargs["text"])
        self.assertIn("Need help", kwargs["text"])
        blocks_str = str(kwargs["blocks"])
        self.assertIn("staff_contact_ack", blocks_str)
        self.assertIn("tab=contact", blocks_str)

    def test_notify_whatif_helper_includes_prompt_snippet(self):
        proposer = User.objects.create_user(email="p@example.com", password="secret12345")
        q = WhatIfQuestion.objects.create(
            prompt="What if {subject} danced?",
            answer_1="1",
            answer_2="2",
            answer_3="3",
            answer_4="4",
            answer_5="5",
            answer_6="6",
            review_status=WhatIfQuestion.ReviewStatus.PENDING,
            proposed_by=proposer,
        )
        with mock.patch("slack_integration.staff_notify.notify_pondarbor_user_dm", return_value={"ok": True}) as mock_dm:
            notify_staff_whatif_question_proposed(question=q)
        self.assertIn("danced", mock_dm.call_args.kwargs["text"])
