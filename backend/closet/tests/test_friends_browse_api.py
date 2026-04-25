from django.test import TestCase
from django.utils import timezone

from closet.constants import FRIENDS_ITEMS_CATEGORY_OTHER
from closet.tests.helpers import ClosetTestMixin
from users.models import User


class ClosetFriendsBrowseApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.borrower, self.friend_two)

    def test_friends_browse_only_includes_friend_owned_items(self):
        owner_item = self.make_item(owner=self.owner, holder=self.owner, name="Owner item")
        friend_two_item = self.make_item(owner=self.friend_two, holder=self.friend_two, name="Friend2 item")
        other_item = self.make_item(owner=self.other, holder=self.other, name="Other item")

        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertIn(owner_item.id, ids)
        self.assertIn(friend_two_item.id, ids)
        # Default policy: browse shows all approved users' published items.
        self.assertIn(other_item.id, ids)

    def test_friends_browse_hides_items_when_friend_owner_suspended(self):
        hidden = self.make_item(owner=self.owner, holder=self.owner, name="Suspended owner item")
        self.owner.account_status = User.AccountStatus.SUSPENDED
        self.owner.save(update_fields=["account_status"])
        hidden.refresh_from_db()
        self.assertIsNotNone(hidden.deleted_at)
        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertNotIn(hidden.id, ids)

    def test_friends_browse_excludes_my_own_items(self):
        mine = self.make_item(owner=self.borrower, holder=self.borrower, name="Mine")
        _friend = self.make_item(owner=self.owner, holder=self.owner, name="Friend")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertNotIn(mine.id, ids)

    def test_friends_browse_respects_viewer_friends_only_read_scope(self):
        # When the viewer sets friends-only, browse should return only friends' items (excluding self).
        prof = self.borrower.profile
        prof.social_read_scope = "friends_only"
        prof.save(update_fields=["social_read_scope"])

        owner_item = self.make_item(owner=self.owner, holder=self.owner, name="Owner item")
        other_item = self.make_item(owner=self.other, holder=self.other, name="Other item")

        resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()["results"]}
        self.assertIn(owner_item.id, ids)
        self.assertNotIn(other_item.id, ids)

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

    def test_friends_browse_filter_by_category(self):
        self.make_item(
            owner=self.owner,
            holder=self.owner,
            name="Tools item",
            category="Tools",
        )
        self.make_item(
            owner=self.owner,
            holder=self.owner,
            name="Clothing item",
            category="Clothing",
        )
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?category=Tools")
        self.assertEqual(resp.status_code, 200)
        names = {row["name"] for row in resp.json()["results"]}
        self.assertEqual(names, {"Tools item"})

    def test_friends_browse_filter_by_category_is_case_insensitive(self):
        self.make_item(owner=self.owner, holder=self.owner, name="A", category="Board Games")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?category=board games")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["results"]), 1)

    def test_friends_browse_filter_by_category_matches_preset_stored_as_tag(self):
        """Preset chosen in UI can match the category field or an exact tag (e.g. legacy / mistagged)."""
        self.make_item(
            owner=self.owner,
            holder=self.owner,
            name="Tagged only",
            category="",
            tags=["Sports/Outdoors"],
        )
        self.make_item(owner=self.owner, holder=self.owner, name="Other", tags=["indoor"])
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?category=Sports%2FOutdoors")
        self.assertEqual(resp.status_code, 200)
        names = {row["name"] for row in resp.json()["results"]}
        self.assertEqual(names, {"Tagged only"})

    def test_friends_browse_filter_by_tag(self):
        self.make_item(
            owner=self.owner,
            holder=self.owner,
            name="Tagged",
            tags=["outdoor", "summer"],
        )
        self.make_item(owner=self.owner, holder=self.owner, name="Other", tags=["indoor"])
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?tag=outdoor")
        self.assertEqual(resp.status_code, 200)
        names = {row["name"] for row in resp.json()["results"]}
        self.assertEqual(names, {"Tagged"})

    def test_friends_browse_filter_by_tag_case_insensitive(self):
        self.make_item(owner=self.owner, holder=self.owner, name="X", tags=["Tool"])
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?tag=tool")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["results"]), 1)

    def test_friends_browse_filter_by_tag_substring(self):
        self.make_item(
            owner=self.owner,
            holder=self.owner,
            name="Potentials",
            tags=["potential", "ski"],
        )
        self.make_item(owner=self.owner, holder=self.owner, name="Other", tags=["foo"])
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?tag=pot")
        self.assertEqual(resp.status_code, 200)
        names = {row["name"] for row in resp.json()["results"]}
        self.assertEqual(names, {"Potentials"})

    def test_friends_browse_filter_category_other_excludes_presets_and_empty(self):
        self.make_item(owner=self.owner, holder=self.owner, name="Custom", category="Games/Board")
        self.make_item(owner=self.owner, holder=self.owner, name="Preset", category="Tools")
        self.make_item(owner=self.owner, holder=self.owner, name="Blank", category="")
        resp = self.borrower_client.get(
            f"/api/v1/closet/items/friends/?category={FRIENDS_ITEMS_CATEGORY_OTHER}",
        )
        self.assertEqual(resp.status_code, 200)
        names = {row["name"] for row in resp.json()["results"]}
        self.assertEqual(names, {"Custom"})

    def test_friends_browse_sort_by_name_asc(self):
        self.make_item(owner=self.owner, holder=self.owner, name="Zebra")
        self.make_item(owner=self.owner, holder=self.owner, name="Apple")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?sort=name_asc&page_size=20")
        self.assertEqual(resp.status_code, 200)
        names = [row["name"] for row in resp.json()["results"]]
        self.assertEqual(names, ["Apple", "Zebra"])

    def test_friends_browse_unknown_sort_defaults_to_updated_desc(self):
        self.make_item(owner=self.owner, holder=self.owner, name="Only")
        resp = self.borrower_client.get("/api/v1/closet/items/friends/?sort=not_a_real_sort")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["results"]), 1)

    def test_friend_owner_items_endpoint_allows_friend(self):
        owned = self.make_item(owner=self.owner, holder=self.owner, name="Owner-only list item")
        other_owned = self.make_item(owner=self.friend_two, holder=self.friend_two, name="Different friend")
        resp = self.borrower_client.get(f"/api/v1/closet/items/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertIn(owned.id, ids)
        self.assertNotIn(other_owned.id, ids)

    def test_friend_owner_items_endpoint_denies_non_friend(self):
        self.clear_friendship(self.owner, self.borrower)
        self.make_item(owner=self.owner, holder=self.owner, name="Private friend item")
        resp = self.borrower_client.get(f"/api/v1/closet/items/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_friend_owner_items_endpoint_rejects_self_lookup(self):
        self.make_item(owner=self.borrower, holder=self.borrower, name="Mine")
        resp = self.borrower_client.get(f"/api/v1/closet/items/friends/{self.borrower.id}/")
        self.assertEqual(resp.status_code, 400)

    def test_friend_owner_items_endpoint_excludes_soft_deleted(self):
        hidden = self.make_item(owner=self.owner, holder=self.owner, name="Hidden in profile")
        hidden.deleted_at = timezone.now()
        hidden.save(update_fields=["deleted_at", "updated_at"])
        resp = self.borrower_client.get(f"/api/v1/closet/items/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertNotIn(hidden.id, ids)

