from django.test import TestCase

from closet.models import BorrowRequest, Loan
from closet.tests.helpers import ClosetTestMixin


class ClosetBorrowRequestsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.owner, self.friend_two)
        self.item = self.make_item(owner=self.owner, holder=self.owner, name="Tent")

    def test_request_requires_date_needed_by(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"message": "Need this"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("date_needed_by", resp.json())

    def test_request_rejects_past_date(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.yesterday)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_owner_cannot_request_own_item(self):
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.today)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_user_cannot_request_item_they_already_hold(self):
        self.item.current_holder_user = self.borrower
        self.item.save(update_fields=["current_holder_user", "updated_at"])
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.today)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already borrowing", str(resp.json()))

    def test_non_friend_cannot_request(self):
        resp = self.other_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.today)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_request_create_persists_date_and_message(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.tomorrow), "message": "Need by tomorrow"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        row = BorrowRequest.objects.get(id=resp.json()["id"])
        self.assertEqual(str(row.date_needed_by), str(self.tomorrow))
        self.assertEqual(row.message, "Need by tomorrow")
        self.assertEqual(row.status, BorrowRequest.Status.PENDING)

    def test_approve_transitions_to_active_loan(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        resp = self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/approve/", format="json")
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(row.status, BorrowRequest.Status.APPROVED)
        self.assertEqual(self.item.current_holder_user_id, self.borrower.id)
        self.assertTrue(Loan.objects.filter(item=self.item, status=Loan.Status.ACTIVE).exists())

    def test_decline_transitions_status_and_sets_response_time(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        resp = self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/decline/", format="json")
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, BorrowRequest.Status.DECLINED)
        self.assertIsNotNone(row.responded_at)
        self.assertEqual(row.decline_message, "")

    def test_decline_persists_optional_decline_message(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        resp = self.owner_client.post(
            f"/api/v1/closet/borrow-requests/{row.id}/decline/",
            {"decline_message": "Sorry, already promised to someone else"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, BorrowRequest.Status.DECLINED)
        self.assertEqual(row.decline_message, "Sorry, already promised to someone else")

    def test_cancel_marks_pending_as_canceled(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        resp = self.borrower_client.post(f"/api/v1/closet/borrow-requests/{row.id}/cancel/", format="json")
        self.assertEqual(resp.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, BorrowRequest.Status.CANCELED)

    def test_cannot_cancel_non_pending_request(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        row.status = BorrowRequest.Status.DECLINED
        row.save(update_fields=["status"])
        resp = self.borrower_client.post(f"/api/v1/closet/borrow-requests/{row.id}/cancel/", format="json")
        self.assertEqual(resp.status_code, 400)

    def test_approve_rejects_when_active_loan_exists(self):
        row = self.make_request(item=self.item, requester=self.friend_two, date_needed_by=self.today)
        self.make_active_loan(item=self.item, owner=self.owner, borrower=self.borrower)
        resp = self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/approve/", format="json")
        self.assertEqual(resp.status_code, 400)

    def test_approve_or_decline_non_pending_fails_cleanly(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        row.status = BorrowRequest.Status.CANCELED
        row.save(update_fields=["status"])

        approve = self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/approve/", format="json")
        self.assertEqual(approve.status_code, 400)

        decline = self.owner_client.post(f"/api/v1/closet/borrow-requests/{row.id}/decline/", format="json")
        self.assertEqual(decline.status_code, 400)

    def test_requester_can_delete_declined_request(self):
        row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        row.status = BorrowRequest.Status.DECLINED
        row.save(update_fields=["status"])
        resp = self.borrower_client.delete(f"/api/v1/closet/borrow-requests/{row.id}/", format="json")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(BorrowRequest.objects.filter(id=row.id).exists())

    def test_delete_declined_request_restricted_by_status_and_user(self):
        pending_row = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        bad_status = self.borrower_client.delete(f"/api/v1/closet/borrow-requests/{pending_row.id}/", format="json")
        self.assertEqual(bad_status.status_code, 400)

        declined = self.make_request(item=self.item, requester=self.borrower, date_needed_by=self.today)
        declined.status = BorrowRequest.Status.DECLINED
        declined.save(update_fields=["status"])
        forbidden = self.owner_client.delete(f"/api/v1/closet/borrow-requests/{declined.id}/", format="json")
        self.assertEqual(forbidden.status_code, 403)

