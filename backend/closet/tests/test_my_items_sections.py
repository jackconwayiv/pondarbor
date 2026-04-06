from django.test import TestCase

from closet.tests.helpers import ClosetTestMixin


class ClosetMyItemsSectionsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.friend_two, self.borrower)

    def test_my_items_sections_grouping_and_order(self):
        borrowed_1 = self.make_item(owner=self.owner, holder=self.borrower, name="Borrowed 1")
        borrowed_2 = self.make_item(owner=self.friend_two, holder=self.borrower, name="Borrowed 2")

        requested_item = self.make_item(owner=self.owner, holder=self.owner, name="Requested")
        self.make_request(item=requested_item, requester=self.borrower, date_needed_by=self.tomorrow)
        declined_item = self.make_item(owner=self.friend_two, holder=self.friend_two, name="Declined")
        declined = self.make_request(item=declined_item, requester=self.borrower, date_needed_by=self.tomorrow)
        declined.status = "declined"
        declined.decline_message = "Not available"
        declined.save(update_fields=["status", "decline_message"])

        owned_1 = self.make_item(owner=self.borrower, holder=self.borrower, name="Owned 1")
        owned_2 = self.make_item(owner=self.borrower, holder=self.borrower, name="Owned 2")

        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()

        declined_ids = [row["id"] for row in payload["declined_by_me"]]
        borrowed_ids = [row["id"] for row in payload["borrowed_by_me"]]
        requested_ids = [row["id"] for row in payload["requested_by_me"]]
        owned_ids = [row["id"] for row in payload["owned_by_me"]]

        self.assertIn(declined_item.id, declined_ids)
        self.assertIn(borrowed_1.id, borrowed_ids)
        self.assertIn(borrowed_2.id, borrowed_ids)
        self.assertIn(requested_item.id, requested_ids)
        self.assertIn(owned_1.id, owned_ids)
        self.assertIn(owned_2.id, owned_ids)

    def test_no_duplicates_between_borrowed_and_requested_sections(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Overlap candidate")
        self.make_request(item=item, requester=self.borrower, date_needed_by=self.tomorrow)

        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()

        borrowed_ids = {row["id"] for row in payload["borrowed_by_me"]}
        requested_ids = {row["id"] for row in payload["requested_by_me"]}
        self.assertIn(item.id, borrowed_ids)
        self.assertNotIn(item.id, requested_ids)

    def test_requested_section_only_includes_pending_requests(self):
        item_pending = self.make_item(owner=self.owner, holder=self.owner, name="Pending")
        item_declined = self.make_item(owner=self.owner, holder=self.owner, name="Declined")
        pending = self.make_request(item=item_pending, requester=self.borrower, date_needed_by=self.tomorrow)
        declined = self.make_request(item=item_declined, requester=self.borrower, date_needed_by=self.tomorrow)
        declined.status = "declined"
        declined.save(update_fields=["status"])

        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        requested_ids = {row["id"] for row in payload["requested_by_me"]}
        self.assertIn(pending.item_id, requested_ids)
        self.assertNotIn(declined.item_id, requested_ids)

    def test_declined_section_includes_declined_with_decline_message(self):
        item_declined = self.make_item(owner=self.owner, holder=self.owner, name="Declined item")
        row = self.make_request(item=item_declined, requester=self.borrower, date_needed_by=self.tomorrow, message="Can I?")
        row.status = "declined"
        row.decline_message = "Need it this weekend."
        row.save(update_fields=["status", "decline_message"])

        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertIn("declined_by_me", payload)
        declined_rows = payload["declined_by_me"]
        self.assertEqual(len(declined_rows), 1)
        self.assertEqual(declined_rows[0]["id"], item_declined.id)
        self.assertIsNotNone(declined_rows[0]["my_declined_request"])
        self.assertEqual(declined_rows[0]["my_declined_request"]["decline_message"], "Need it this weekend.")

    def test_custody_offered_to_me_section(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Offered")
        self.owner_client.post(
            f"/api/v1/closet/items/{item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )

        resp = self.borrower_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertIn("custody_offered_to_me", payload)
        offered_ids = {row["id"] for row in payload["custody_offered_to_me"]}
        self.assertIn(item.id, offered_ids)
        borrowed_ids = {row["id"] for row in payload["borrowed_by_me"]}
        self.assertNotIn(item.id, borrowed_ids)

