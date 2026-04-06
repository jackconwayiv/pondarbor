from django.test import TestCase

from closet.tests.helpers import ClosetTestMixin


class ClosetPermissionsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.owner, self.friend_two)
        self.item = self.make_item(owner=self.owner, holder=self.owner, name="Shared Jacket")
        self.request = self.make_request(item=self.item, requester=self.borrower)
        self.loan = self.make_active_loan(item=self.item, owner=self.owner, borrower=self.borrower)
        self.item.current_holder_user = self.borrower
        self.item.save(update_fields=["current_holder_user"])

    def test_anonymous_access_is_rejected_for_protected_endpoints(self):
        resp = self.anon_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 403)

        resp = self.anon_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 403)

        resp = self.anon_client.post(
            f"/api/v1/closet/items/{self.item.id}/borrow-requests/",
            {"date_needed_by": str(self.today)},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_only_owner_can_patch_delete_or_set_custody(self):
        patch_resp = self.borrower_client.patch(
            f"/api/v1/closet/items/{self.item.id}/",
            {"name": "Not allowed"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 403)

        delete_resp = self.borrower_client.delete(f"/api/v1/closet/items/{self.item.id}/")
        self.assertEqual(delete_resp.status_code, 403)

        custody_resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.friend_two.id},
            format="json",
        )
        self.assertEqual(custody_resp.status_code, 403)

    def test_only_owner_can_approve_or_decline_requests(self):
        approve_as_borrower = self.borrower_client.post(
            f"/api/v1/closet/borrow-requests/{self.request.id}/approve/",
            format="json",
        )
        self.assertEqual(approve_as_borrower.status_code, 403)

        decline_as_other = self.other_client.post(
            f"/api/v1/closet/borrow-requests/{self.request.id}/decline/",
            format="json",
        )
        self.assertEqual(decline_as_other.status_code, 403)

    def test_only_requester_can_cancel_request(self):
        cancel_other = self.other_client.post(
            f"/api/v1/closet/borrow-requests/{self.request.id}/cancel/",
            format="json",
        )
        self.assertEqual(cancel_other.status_code, 403)

        cancel_owner = self.owner_client.post(
            f"/api/v1/closet/borrow-requests/{self.request.id}/cancel/",
            format="json",
        )
        self.assertEqual(cancel_owner.status_code, 403)

    def test_only_borrower_can_mark_returned_by_borrower(self):
        resp = self.other_client.post(
            f"/api/v1/closet/loans/{self.loan.id}/mark-returned-by-borrower/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

        owner_resp = self.owner_client.post(
            f"/api/v1/closet/loans/{self.loan.id}/mark-returned-by-borrower/",
            format="json",
        )
        self.assertEqual(owner_resp.status_code, 403)

    def test_only_owner_can_mark_returned(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/loans/{self.loan.id}/mark-returned/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_only_current_holder_can_deny_custody(self):
        # Current holder is borrower.
        owner_resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/deny-custody/",
            format="json",
        )
        self.assertEqual(owner_resp.status_code, 403)

        other_resp = self.other_client.post(
            f"/api/v1/closet/items/{self.item.id}/deny-custody/",
            format="json",
        )
        self.assertEqual(other_resp.status_code, 403)

    def test_only_owner_or_holder_can_view_item_requests(self):
        owner_resp = self.owner_client.get(f"/api/v1/closet/items/{self.item.id}/borrow-requests/list/")
        self.assertEqual(owner_resp.status_code, 200)

        holder_resp = self.borrower_client.get(f"/api/v1/closet/items/{self.item.id}/borrow-requests/list/")
        self.assertEqual(holder_resp.status_code, 200)

        other_resp = self.other_client.get(f"/api/v1/closet/items/{self.item.id}/borrow-requests/list/")
        self.assertEqual(other_resp.status_code, 403)

