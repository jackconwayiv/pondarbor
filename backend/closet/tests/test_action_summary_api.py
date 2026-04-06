from django.utils import timezone

from closet.tests.helpers import ClosetTestMixin
from django.test import TestCase


class ClosetActionSummaryApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)

    def test_zero_when_nothing_pending(self):
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 0)

    def test_counts_incoming_borrows_per_pending_request(self):
        item_a = self.make_item(owner=self.owner, holder=self.owner, name="A")
        item_b = self.make_item(owner=self.owner, holder=self.owner, name="B")
        self.make_request(item=item_a, requester=self.borrower, date_needed_by=self.tomorrow)
        self.make_friends(self.owner, self.friend_two)
        self.make_request(item=item_b, requester=self.friend_two, date_needed_by=self.tomorrow)
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 2)

    def test_excludes_borrow_requests_when_item_deleted(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Gone")
        self.make_request(item=item, requester=self.borrower, date_needed_by=self.tomorrow)
        item.deleted_at = timezone.now()
        item.save(update_fields=["deleted_at", "updated_at"])
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 0)

    def test_counts_custody_dispute_as_owner(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Disputed")
        item.custody_disputed = True
        item.save(update_fields=["custody_disputed", "updated_at"])
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 1)

    def test_counts_loan_return_waiting_on_owner(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Loaned")
        loan = self.make_active_loan(item=item, owner=self.owner, borrower=self.borrower)
        loan.marked_returned_by_borrower_at = timezone.now()
        loan.save(update_fields=["marked_returned_by_borrower_at"])
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 1)

    def test_counts_custody_handoff_waiting_on_owner_without_active_loan(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Custody")
        item.custody_marked_returned_by_holder_at = timezone.now()
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 1)

    def test_excludes_custody_handoff_when_active_loan_exists(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Both")
        self.make_active_loan(item=item, owner=self.owner, borrower=self.borrower)
        item.custody_marked_returned_by_holder_at = timezone.now()
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 0)

    def test_counts_custody_invite_for_pending_acceptance_user(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Offer")
        item.custody_pending_acceptance_user = self.borrower
        item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
        resp = self.borrower_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 1)

    def test_sums_multiple_buckets(self):
        item_loan = self.make_item(owner=self.owner, holder=self.borrower, name="L")
        loan = self.make_active_loan(item=item_loan, owner=self.owner, borrower=self.borrower)
        loan.marked_returned_by_borrower_at = timezone.now()
        loan.save(update_fields=["marked_returned_by_borrower_at"])

        item_borrow = self.make_item(owner=self.owner, holder=self.owner, name="B")
        self.make_request(item=item_borrow, requester=self.borrower, date_needed_by=self.tomorrow)

        resp = self.owner_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["outstanding_actions_count"], 2)

    def test_rejects_anonymous(self):
        resp = self.anon_client.get("/api/v1/closet/action-summary/")
        self.assertEqual(resp.status_code, 403)
