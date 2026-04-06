from django.test import TestCase, override_settings
from django.utils import timezone

from closet.models import Item
from closet.tests.helpers import ClosetTestMixin


class ClosetItemsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.owner, self.friend_two)

    def test_create_item_sets_owner_as_current_holder(self):
        resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Hammer", "description": "Steel", "tags": ["tool", "garage"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertEqual(payload["owner_user"]["id"], self.owner.id)
        self.assertEqual(payload["current_holder_user"]["id"], self.owner.id)
        self.assertEqual(payload["name"], "Hammer")

    def test_patch_item_updates_fields(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Old")
        resp = self.owner_client.patch(
            f"/api/v1/closet/items/{item.id}/",
            {"name": "New", "category": "Tools", "tags": ["drill"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.name, "New")
        self.assertEqual(item.category, "Tools")
        self.assertEqual(item.tags, ["drill"])

    def test_create_item_accepts_custom_category_letters_and_slash(self):
        resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Box", "category": "Games/Board"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["category"], "Games/Board")

    def test_create_item_accepts_board_games_preset(self):
        resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Catan", "category": "Board Games"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["category"], "Board Games")

    def test_create_item_rejects_invalid_category(self):
        resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Bad", "category": "not valid"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_item_rejects_invalid_category(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="X")
        resp = self.owner_client.patch(
            f"/api/v1/closet/items/{item.id}/",
            {"category": "no spaces"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_delete_soft_deletes_item(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Delete me")
        resp = self.owner_client.delete(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(resp.status_code, 204)
        item.refresh_from_db()
        self.assertIsNotNone(item.deleted_at)

    def test_soft_deleted_item_hidden_from_mine_and_friends(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Hidden")
        item.deleted_at = timezone.now()
        item.save(update_fields=["deleted_at", "updated_at"])

        owner_resp = self.owner_client.get("/api/v1/closet/items/")
        self.assertEqual(owner_resp.status_code, 200)
        owned_ids = {row["id"] for row in owner_resp.json()["owned_by_me"]}
        self.assertNotIn(item.id, owned_ids)

        friend_resp = self.borrower_client.get("/api/v1/closet/items/friends/")
        self.assertEqual(friend_resp.status_code, 200)
        friend_ids = {row["id"] for row in friend_resp.json()["results"]}
        self.assertNotIn(item.id, friend_ids)

    def test_item_detail_visible_to_owner_holder_and_owner_friend(self):
        item = self.make_item(owner=self.owner, holder=self.borrower, name="Visible")
        owner_get = self.owner_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(owner_get.status_code, 200)

        holder_get = self.borrower_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(holder_get.status_code, 200)

        self.make_friends(self.owner, self.friend_two)
        friend_get = self.friend_two_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(friend_get.status_code, 200)

    def test_item_detail_not_visible_to_unrelated_user(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Private")
        resp = self.other_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_item_detail_visible_to_pending_custody_recipient(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Pending custody")
        self.owner_client.post(
            f"/api/v1/closet/items/{item.id}/set-custody/",
            {"holder_user_id": self.borrower.id},
            format="json",
        )
        resp = self.borrower_client.get(f"/api/v1/closet/items/{item.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["pending_custody_user"]["id"], self.borrower.id)

    @override_settings(CLOSET_R2_PUBLIC_BASE_URL="")
    def test_item_serializer_image_url_empty_without_public_base(self):
        key = f"closet/{self.owner.id}/20240101/abc.jpg"
        self.make_item(owner=self.owner, holder=self.owner, name="Pic", image_key=key)
        resp = self.owner_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        row = next(i for i in resp.json()["owned_by_me"] if i["name"] == "Pic")
        self.assertEqual(row["image_key"], key)
        self.assertEqual(row.get("image_url") or "", "")

    @override_settings(CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test", CLOSET_R2_KEY_PREFIX="closet")
    def test_item_serializer_image_url_joins_public_base(self):
        key = f"closet/{self.owner.id}/20240101/abc.jpg"
        self.make_item(owner=self.owner, holder=self.owner, name="Pic2", image_key=key)
        resp = self.owner_client.get("/api/v1/closet/items/")
        self.assertEqual(resp.status_code, 200)
        row = next(i for i in resp.json()["owned_by_me"] if i["name"] == "Pic2")
        self.assertEqual(row["image_url"], f"https://cdn.example.test/{key}")

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    def test_patch_rejects_image_key_wrong_prefix(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="X")
        resp = self.owner_client.patch(
            f"/api/v1/closet/items/{item.id}/",
            {"image_key": f"closet/{self.borrower.id}/20240101/nope.jpg"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    def test_create_rejects_image_key_wrong_prefix(self):
        resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {
                "name": "Bad key",
                "image_key": f"closet/{self.borrower.id}/20240101/nope.jpg",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    def test_patch_accepts_image_key_for_owner_prefix(self):
        item = self.make_item(owner=self.owner, holder=self.owner, name="Y")
        key = f"closet/{self.owner.id}/20240101/ok.jpg"
        resp = self.owner_client.patch(
            f"/api/v1/closet/items/{item.id}/",
            {"image_key": key},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["image_key"], key)

