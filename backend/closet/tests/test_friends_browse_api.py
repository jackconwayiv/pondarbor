from django.test import TestCase

from closet.tests.helpers import ClosetTestMixin


class ClosetFriendsBrowseApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.borrower, self.friend_two)

    def test_friends_browse_only_includes_friend_owned_items(self):
        owner_item = self.make_item(owner=self.owner, holder=self.owner, name="Owner item")
        friend_two_item = self.make_item(owner=self.friend_two, holder=self.friend_two, name="Friend2 item")
        _other_item = self.make_item(owner=self.other, holder=self.other, name="Other item")

        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertIn(owner_item.id, ids)
        self.assertIn(friend_two_item.id, ids)
        self.assertNotIn(_other_item.id, ids)

    def test_friends_browse_excludes_my_own_items(self):
        mine = self.make_item(owner=self.borrower, holder=self.borrower, name="Mine")
        _friend = self.make_item(owner=self.owner, holder=self.owner, name="Friend")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertNotIn(mine.id, ids)

    def test_friends_browse_pagination_shape(self):
        for idx in range(12):
            self.make_item(owner=self.owner, holder=self.owner, name=f"Item {idx}")
        resp_page1 = self.borrower_client.get("/api/v1/closet/items/friends/?page=1&page_size=5")
        self.assertEqual(resp_page1.status_code, 200)
        payload1 = resp_page1.json()
        self.assertEqual(payload1["page"], 1)
        self.assertEqual(payload1["page_size"], 5)
        self.assertEqual(len(payload1["results"]), 5)
        self.assertTrue(payload1["has_next"])
        self.assertFalse(payload1["has_prev"])

        resp_page3 = self.borrower_client.get("/api/v1/closet/items/friends/?page=3&page_size=5")
        self.assertEqual(resp_page3.status_code, 200)
        payload3 = resp_page3.json()
        self.assertEqual(payload3["page"], 3)
        self.assertLessEqual(len(payload3["results"]), 5)
        self.assertTrue(payload3["has_prev"])

    def test_friends_browse_page_size_is_capped(self):
        for idx in range(70):
            self.make_item(owner=self.owner, holder=self.owner, name=f"Bulk {idx}")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?page=1&page_size=999")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["page_size"], 50)
        self.assertEqual(len(payload["results"]), 50)

