from django.test import TestCase
from django.utils import timezone

from closet.models import BorrowRequest, Loan
from closet.tests.helpers import ClosetTestMixin


class ClosetLoansAndReturnsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.owner, self.friend_two)
        self.item = self.make_item(owner=self.owner, holder=self.borrower, name="Sleeping Bag")
        self.loan = self.make_active_loan(item=self.item, owner=self.owner, borrower=self.borrower)

    def test_borrower_mark_returned_sets_timestamp_only(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/loans/{self.loan.id}/mark-returned-by-borrower/",
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.loan.refresh_from_db()
        self.assertIsNotNone(self.loan.marked_returned_by_borrower_at)
        self.assertEqual(self.loan.status, Loan.Status.ACTIVE)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.borrower.id)

    def test_items_payload_flags_borrower_marked_returned_for_active_loan(self):
        self.loan.marked_returned_by_borrower_at = timezone.now()
        self.loan.save(update_fields=["marked_returned_by_borrower_at"])
        resp = self.owner_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        item_row = next(row for row in resp.json()["owned_by_me"] if row["id"] == self.item.id)
        self.assertTrue(item_row["active_loan_marked_returned_by_borrower"])

    def test_owner_mark_returned_completes_loan_and_resets_custody(self):
        resp = self.owner_client.post(f"/api/v1/closet/loans/{self.loan.id}/mark-returned/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.loan.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.loan.status, Loan.Status.RETURNED)
        self.assertIsNotNone(self.loan.marked_returned_by_owner_at)
        self.assertIsNotNone(self.loan.returned_at)
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)

    def test_owner_mark_returned_rejects_non_active_loans(self):
        self.loan.status = Loan.Status.RETURNED
        self.loan.save(update_fields=["status"])
        resp = self.owner_client.post(f"/api/v1/closet/loans/{self.loan.id}/mark-returned/", format="json")
        self.assertEqual(resp.status_code, 400)

    def test_borrower_mark_returned_rejects_non_active_loans(self):
        self.loan.status = Loan.Status.CANCELED
        self.loan.save(update_fields=["status"])
        resp = self.borrower_client.post(
            f"/api/v1/closet/loans/{self.loan.id}/mark-returned-by-borrower/",
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_completion_keeps_other_pending_requests_unchanged(self):
        first = self.make_request(item=self.item, requester=self.friend_two, date_needed_by=self.tomorrow)
        second = self.make_request(item=self.item, requester=self.owner, date_needed_by=self.tomorrow)
        # owner request is invalid by endpoint policy; make it explicit pending row for state check only
        second.requester_user = self.borrower
        second.status = BorrowRequest.Status.PENDING
        second.save(update_fields=["requester_user", "status"])

        resp = self.owner_client.post(f"/api/v1/closet/loans/{self.loan.id}/mark-returned/", format="json")
        self.assertEqual(resp.status_code, 200)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, BorrowRequest.Status.PENDING)
        self.assertEqual(second.status, BorrowRequest.Status.PENDING)

