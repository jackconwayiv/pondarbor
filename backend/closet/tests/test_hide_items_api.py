from django.test import TestCase

from closet.models import BorrowRequest, ItemHidden
from closet.tests.helpers import ClosetTestMixin


class ClosetHideItemsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.borrower, self.friend_two)

    # --- Eligibility ---

    def test_owner_cannot_hide_their_own_item(self):
        item = self.make_item(owner=self.borrower, holder=self.borrower, name="Mine")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(ItemHidden.objects.filter(user=self.borrower, item=item).count(), 0)

    def test_borrower_cannot_hide_item_they_currently_hold(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Held by me")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 400)

    def test_pending_requester_cannot_hide(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Wanted")
        self.make_request(item=item, requester=self.borrower)
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 400)

    def test_declined_requester_cannot_hide(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Was wanted")
        req = self.make_request(item=item, requester=self.borrower)
        req.status = BorrowRequest.Status.DECLINED
        req.save(update_fields=["status"])
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 400)

    def test_pending_custody_recipient_cannot_hide(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Offered to me")
        item.custody_pending_acceptance_user = self.borrower
        item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 400)

    def test_friend_with_no_relationship_can_hide(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ItemHidden.objects.filter(user=self.borrower, item=item).count(), 1)
        self.assertTrue(resp.json()["hidden_by_me"])

    # --- Idempotency / unhide ---

    def test_hide_is_idempotent(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ItemHidden.objects.filter(user=self.borrower, item=item).count(), 1)

    def test_unhide_removes_hidden_record(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        self.borrower_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/unhide/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ItemHidden.objects.filter(user=self.borrower, item=item).count(), 0)
        self.assertFalse(resp.json()["hidden_by_me"])

    def test_unhide_when_not_hidden_is_idempotent(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        resp = self.borrower_client.post(f"/api/v1/closet/items/{item.id}/unhide/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["hidden_by_me"])

    # --- Serializer surfacing ---

    def test_friends_browse_returns_hidden_by_me_true_when_marked(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        ItemHidden.objects.create(user=self.borrower, item=item)
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?include_self=true")
        self.assertEqual(resp.status_code, 200)
        rows_by_id = {row["id"]: row for row in resp.json()["results"]}
        self.assertTrue(rows_by_id[item.id]["hidden_by_me"])

    def test_friends_browse_does_not_filter_hidden_items(self):
        """Hidden items must still ride along so the client can toggle Show Hidden without a refetch."""
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        ItemHidden.objects.create(user=self.borrower, item=item)
        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertIn(item.id, ids)

    def test_my_items_payload_exposes_hidden_by_me_field(self):
        mine = self.make_item(owner=self.borrower, holder=self.borrower, name="Mine")
        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        owned = resp.json()["owned_by_me"]
        self.assertTrue(any(row["id"] == mine.id for row in owned))
        for row in owned:
            self.assertIn("hidden_by_me", row)
            self.assertFalse(row["hidden_by_me"])  # owner of own items is never hidden

    def test_item_detail_exposes_hidden_by_me_field(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        ItemHidden.objects.create(user=self.borrower, item=item)
        resp = self.borrower_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["hidden_by_me"])

    # --- Auth ---

    def test_anon_cannot_hide(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Browseable")
        resp = self.anon_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertIn(resp.status_code, (401, 403))

    def test_non_friend_unrelated_user_cannot_hide_item_they_cannot_see(self):
        # `other` is not friends with `owner`; the hide endpoint requires the item be visible.
        item = self.make_item(owner=self.owner, holder=self.owner, name="Owner item")
        resp = self.other_client.post(f"/api/v1/closet/items/{item.id}/hide/")
        self.assertEqual(resp.status_code, 404)
