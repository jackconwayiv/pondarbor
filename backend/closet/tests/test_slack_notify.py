import json
from unittest import mock

from django.test.utils import override_settings

from closet.models import BorrowRequest, Loan
from closet.tests.helpers import ClosetTestMixin
from closet.slack_notify import (
    build_closet_inbox_blocks,
    build_loans_summary_blocks,
    notify_borrow_request_to_owner,
)
from django.test import TestCase

from slack_integration.models import SlackIdentity


@override_settings(
    PONDARBOR_ORIGIN="https://pondarbor.com",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
    SLACK_BOT_TOKEN="xoxb-test",
)
class ClosetSlackNotifyTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.item = self.make_item(owner=self.owner, name="Winter jacket")
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_owner", user=self.owner)

    @mock.patch("closet.slack_notify.notify_closet_channel_ephemeral")
    def test_borrow_request_notify_includes_approve_buttons(self, mock_dm):
        row = self.make_request(item=self.item, requester=self.borrower, message="For the hike")
        notify_borrow_request_to_owner(row=row, is_update=False)
        mock_dm.assert_called_once()
        _user, kwargs = mock_dm.call_args
        blocks = kwargs["blocks"]
        action_ids = []
        for block in blocks:
            if block.get("type") == "actions":
                action_ids.extend(el.get("action_id") for el in block.get("elements", []))
        self.assertIn("closet_approve", action_ids)
        self.assertIn("closet_decline", action_ids)
        self.assertIn("Winter jacket", kwargs["text"])

    @mock.patch("closet.slack_notify.notify_closet_channel_ephemeral")
    def test_borrow_request_create_schedules_owner_dm(self, mock_dm):
        with self.captureOnCommitCallbacks(execute=True):
            self.borrower_client.post(
                f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
                {"date_needed_by": str(self.tomorrow), "message": "Please"},
                format="json",
            )
        self.assertEqual(mock_dm.call_count, 1)

    def test_inbox_includes_pending_borrow_for_owner(self):
        self.make_request(item=self.item, requester=self.borrower)
        blocks, _ = build_closet_inbox_blocks(self.owner)
        flat = json.dumps(blocks)
        self.assertIn("Winter jacket", flat)
        self.assertIn("closet_approve", flat)
        self.assertIn("https://pondarbor.com/closet?tab=items&item=", flat)

    def test_loans_summary_includes_active_loan(self):
        row = self.make_request(item=self.item, requester=self.borrower)
        self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/approve/")
        blocks, _ = build_loans_summary_blocks(self.owner)
        flat = json.dumps(blocks)
        self.assertIn("Out with friends", flat)
        self.assertIn("Winter jacket", flat)

    def test_loans_summary_pending_requests_footer(self):
        other_item = self.make_item(owner=self.friend_two, name="Cooler")
        self.make_friends(self.borrower, self.friend_two)
        self.make_request(item=other_item, requester=self.borrower, date_needed_by=self.tomorrow)
        blocks, _ = build_loans_summary_blocks(self.borrower)
        flat = json.dumps(blocks)
        self.assertIn("Waiting on others", flat)
        self.assertIn("Cooler", flat)

    @mock.patch("closet.slack_notify.notify_closet_channel_ephemeral")
    def test_loan_return_completed_notifies_borrower(self, mock_dm):
        row = self.make_request(item=self.item, requester=self.borrower)
        self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/approve/")
        loan = Loan.objects.get(item=self.item, status=Loan.Status.ACTIVE)
        with self.captureOnCommitCallbacks(execute=True):
            self.borrower_client.post(f"/api/v1/closet/loans/{loan.id}/mark-returned-by-borrower/")
        mock_dm.reset_mock()
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_borrower", user=self.borrower)
        with self.captureOnCommitCallbacks(execute=True):
            self.owner_client.post(f"/api/v1/closet/loans/{loan.id}/mark-returned/")
        self.assertTrue(mock_dm.called)
        texts = [c.kwargs.get("text", "") for c in mock_dm.call_args_list]
        self.assertTrue(any("confirmed your return" in t for t in texts))

    @mock.patch("closet.slack_notify.notify_closet_channel_ephemeral")
    def test_cancel_borrow_notifies_owner(self, mock_dm):
        row = self.make_request(item=self.item, requester=self.borrower)
        mock_dm.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            self.borrower_client.post(f"/api/v1/closet/borrow-requests/{row.id}/cancel/")
        self.assertEqual(mock_dm.call_count, 1)
        self.assertIn("canceled", mock_dm.call_args.kwargs["text"].lower())
