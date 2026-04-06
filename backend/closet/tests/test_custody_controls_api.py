from django.test import TestCase

from closet.tests.helpers import ClosetTestMixin


class ClosetCustodyControlsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.item = self.make_item(owner=self.owner, holder=self.owner, name="Bike")

    def test_owner_assigning_friend_creates_pending_without_changing_holder(self):
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)
        self.assertEqual(self.item.custody_pending_acceptance_user_id, self.borrower.id)

    def test_friend_accepts_pending_then_becomes_holder(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        accept = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(accept.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.borrower.id)
        self.assertIsNone(self.item.custody_pending_acceptance_user_id)

    def test_friend_rejects_pending_holder_unchanged(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        reject = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/reject-pending-custody/",
            format="json",
        )
        self.assertEqual(reject.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)
        self.assertIsNone(self.item.custody_pending_acceptance_user_id)

    def test_owner_cancel_pending_clears_offer(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        cancel = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/cancel-pending-custody/",
            format="json",
        )
        self.assertEqual(cancel.status_code, 200)
        self.item.refresh_from_db()
        self.assertIsNone(self.item.custody_pending_acceptance_user_id)

    def test_owner_assigning_self_clears_pending_and_sets_holder(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        to_self = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.owner.id},
            format="json",
        )
        self.assertEqual(to_self.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)
        self.assertIsNone(self.item.custody_pending_acceptance_user_id)

    def test_owner_cannot_set_custody_to_non_friend(self):
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.other.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_set_custody_requires_holder_user_id(self):
        resp = self.owner_client.post(f"/api/v1/closet/items/{self.item.id}/set-custody/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_holder_can_deny_custody_and_owner_resolves_by_reset(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        self.item.refresh_from_db()
        deny = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/deny-custody/",
            format="json",
        )
        self.assertEqual(deny.status_code, 200)
        self.item.refresh_from_db()
        self.assertTrue(self.item.custody_disputed)
        self.assertEqual(self.item.current_holder_user_id, self.borrower.id)

        resolve = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.owner.id},
            format="json",
        )
        self.assertEqual(resolve.status_code, 200)
        self.item.refresh_from_db()
        self.assertFalse(self.item.custody_disputed)
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)

    def test_holder_marks_custody_return_then_owner_completes(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        self.item.refresh_from_db()
        mark = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/mark-custody-returned-by-holder/",
            format="json",
        )
        self.assertEqual(mark.status_code, 200)
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.custody_marked_returned_by_holder_at)
        self.assertEqual(self.item.current_holder_user_id, self.borrower.id)

        complete = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/complete-custody-return/",
            format="json",
        )
        self.assertEqual(complete.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)
        self.assertIsNone(self.item.custody_marked_returned_by_holder_at)

    def test_mark_custody_return_rejects_when_active_loan(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        self.make_active_loan(item=self.item, owner=self.owner, borrower=self.borrower)
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/mark-custody-returned-by-holder/",
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_mark_custody_return_forbidden_for_non_holder(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/mark-custody-returned-by-holder/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_complete_custody_return_forbidden_for_non_owner(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/mark-custody-returned-by-holder/",
            format="json",
        )
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/complete-custody-return/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_complete_custody_return_rejects_without_holder_mark(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/complete-custody-return/",
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_set_custody_clears_pending_custody_return_mark(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.borrower_client.post(f"/api/v1/closet/items/{self.item.id}/accept-custody/", format="json")
        self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/mark-custody-returned-by-holder/",
            format="json",
        )
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.custody_marked_returned_by_holder_at)

        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.owner.id},
            format="json",
        )
        self.item.refresh_from_db()
        self.assertIsNone(self.item.custody_marked_returned_by_holder_at)

    def test_accept_pending_custody_forbidden_for_owner(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("pending custody offer", resp.json()["detail"].lower())

    def test_accept_pending_custody_forbidden_for_wrong_friend(self):
        self.make_friends(self.owner, self.friend_two)
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.friend_two_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_reject_pending_custody_forbidden_for_wrong_friend(self):
        self.make_friends(self.owner, self.friend_two)
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.friend_two_client.post(
            f"/api/v1/closet/items/{self.item.id}/reject-pending-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_accept_pending_custody_forbidden_for_stranger(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.other_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_reject_pending_custody_forbidden_for_owner(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/reject-pending-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_accept_when_no_pending_returns_403(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_reject_when_no_pending_returns_403(self):
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/reject-pending-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_cancel_pending_custody_forbidden_for_non_owner(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/cancel-pending-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_cancel_pending_custody_fails_when_none_pending(self):
        resp = self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/cancel-pending-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("no pending", resp.json()["detail"].lower())

    def test_owner_reassigning_pending_offer_updates_recipient(self):
        self.make_friends(self.owner, self.friend_two)
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.custody_pending_acceptance_user_id, self.borrower.id)

        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.friend_two.id},
            format="json",
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.owner.id)
        self.assertEqual(self.item.custody_pending_acceptance_user_id, self.friend_two.id)

        br_bad = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(br_bad.status_code, 403)

        ok = self.friend_two_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_holder_user_id, self.friend_two.id)
        self.assertIsNone(self.item.custody_pending_acceptance_user_id)

    def test_accept_custody_fails_when_recipient_unfriended_owner(self):
        self.owner_client.post(
            f"/api/v1/closet/items/{self.item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        self.clear_friendship(self.borrower, self.owner)
        resp = self.borrower_client.post(
            f"/api/v1/closet/items/{self.item.id}/accept-custody/",
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("friends", resp.json()["detail"].lower())
