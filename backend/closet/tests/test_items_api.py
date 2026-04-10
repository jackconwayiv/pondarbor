from django.test import TestCase, override_settings
from django.utils import timezone
from unittest.mock import patch

from achievements.models import AchievementDefinition, UserAchievement
from closet.models import Item
from closet.serializers import closet_image_key_owned_by_user
from closet.tests.helpers import ClosetTestMixin
from achievements.services import SLUG_SHARING_IS_CARING


class ClosetItemsApiTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        self.make_friends(self.owner, self.friend_two)
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_SHARING_IS_CARING,
            defaults={
                "title": "Sharing is Caring",
                "description": "",
                "category": "closet",
                "order": 60,
            },
        )

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

    def test_create_item_requires_approved_authenticated_user(self):
        anon_resp = self.anon_client.post(
            "/api/v1/closet/items/",
            {"name": "Anon item"},
            format="json",
        )
        self.assertIn(anon_resp.status_code, (401, 403))

        self.owner.account_status = self.owner.AccountStatus.PENDING
        self.owner.save(update_fields=["account_status"])
        non_approved_resp = self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Pending item"},
            format="json",
        )
        self.assertEqual(non_approved_resp.status_code, 403)

    def test_uploads_presign_requires_approved_authenticated_user(self):
        anon_resp = self.anon_client.post(
            "/api/v1/closet/uploads/presign/",
            {"content_type": "image/jpeg"},
            format="json",
        )
        self.assertIn(anon_resp.status_code, (401, 403))

        self.owner.account_status = self.owner.AccountStatus.PENDING
        self.owner.save(update_fields=["account_status"])
        non_approved_resp = self.owner_client.post(
            "/api/v1/closet/uploads/presign/",
            {"content_type": "image/jpeg"},
            format="json",
        )
        self.assertEqual(non_approved_resp.status_code, 403)

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

    def test_sharing_is_caring_unlocks_at_five_active_owned_items(self):
        for idx in range(4):
            self.owner_client.post(
                "/api/v1/closet/items/",
                {"name": f"Item {idx}"},
                format="json",
            )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.owner,
                achievement__slug=SLUG_SHARING_IS_CARING,
            ).exists()
        )
        self.owner_client.post(
            "/api/v1/closet/items/",
            {"name": "Item 5"},
            format="json",
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.owner,
                achievement__slug=SLUG_SHARING_IS_CARING,
            ).exists()
        )

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

    @override_settings(CLOSET_R2_KEY_PREFIX="closet", CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test")
    @patch("closet.views._build_r2_client")
    def test_images_inventory_shows_attached_and_stranded(self, build_client_mock):
        attached_key = f"closet/{self.owner.id}/20240101/attached.jpg"
        avatar_key = f"closet/{self.owner.id}/20240101/avatar.jpg"
        stranded_key = f"closet/{self.owner.id}/20240101/stranded.jpg"
        self.make_item(owner=self.owner, holder=self.owner, name="Pic", image_key=attached_key)
        self.owner.profile.avatar_url = f"https://cdn.example.test/{avatar_key}"
        self.owner.profile.save(update_fields=["avatar_url"])
        other_user_key = f"closet/{self.borrower.id}/20240101/other.jpg"

        client = build_client_mock.return_value
        client.list_objects_v2.side_effect = [
            {
                "Contents": [
                    {"Key": attached_key},
                    {"Key": avatar_key},
                    {"Key": stranded_key},
                    {"Key": other_user_key},
                ],
                "IsTruncated": False,
            }
        ]
        with patch.dict(
            "os.environ",
            {
                "CLOUDFLARE_ACCOUNT_ID": "acct",
                "CLOSET_R2_BUCKET": "bucket",
                "CLOSET_R2_ACCESS_KEY_ID": "ak",
                "CLOSET_R2_SECRET_ACCESS_KEY": "sk",
            },
            clear=False,
        ):
            resp = self.owner_client.get("/api/v1/closet/images/")
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()["results"]
        by_key = {row["image_key"]: row for row in rows}
        self.assertEqual(by_key[attached_key]["status"], "attached")
        self.assertEqual(by_key[attached_key]["attached_live_item_count"], 1)
        self.assertEqual(by_key[avatar_key]["status"], "attached")
        self.assertEqual(by_key[avatar_key]["attached_live_item_count"], 0)
        self.assertTrue(by_key[avatar_key]["attached_as_avatar"])
        self.assertEqual(by_key[stranded_key]["status"], "stranded")
        self.assertEqual(by_key[stranded_key]["attached_live_item_count"], 0)
        self.assertFalse(by_key[stranded_key]["attached_as_avatar"])
        self.assertNotIn(other_user_key, by_key)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    @patch("closet.views._build_r2_client")
    def test_image_delete_detaches_live_items_and_deletes_bucket_object(self, build_client_mock):
        key = f"closet/{self.owner.id}/20240101/removable.jpg"
        keep_key = f"closet/{self.owner.id}/20240101/keep.jpg"
        attached = self.make_item(owner=self.owner, holder=self.owner, name="A", image_key=key)
        self.make_item(owner=self.owner, holder=self.owner, name="B", image_key=keep_key)
        self.make_item(owner=self.borrower, holder=self.borrower, name="C", image_key=key)
        client = build_client_mock.return_value
        with patch.dict(
            "os.environ",
            {
                "CLOUDFLARE_ACCOUNT_ID": "acct",
                "CLOSET_R2_BUCKET": "bucket",
                "CLOSET_R2_ACCESS_KEY_ID": "ak",
                "CLOSET_R2_SECRET_ACCESS_KEY": "sk",
            },
            clear=False,
        ):
            resp = self.owner_client.post("/api/v1/closet/images/delete/", {"image_key": key}, format="json")
        self.assertEqual(resp.status_code, 200)
        attached.refresh_from_db()
        self.assertEqual(attached.image_key, "")
        client.delete_object.assert_called_once_with(Bucket="bucket", Key=key)

    @override_settings(
        CLOSET_R2_KEY_PREFIX="closet",
        CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test",
    )
    @patch("closet.views._build_r2_client")
    def test_image_delete_detaches_matching_avatar_url(self, build_client_mock):
        key = f"closet/{self.owner.id}/20240101/avatar.jpg"
        self.owner.profile.avatar_url = f"https://cdn.example.test/{key}"
        self.owner.profile.save(update_fields=["avatar_url"])
        client = build_client_mock.return_value
        with patch.dict(
            "os.environ",
            {
                "CLOUDFLARE_ACCOUNT_ID": "acct",
                "CLOSET_R2_BUCKET": "bucket",
                "CLOSET_R2_ACCESS_KEY_ID": "ak",
                "CLOSET_R2_SECRET_ACCESS_KEY": "sk",
            },
            clear=False,
        ):
            resp = self.owner_client.post("/api/v1/closet/images/delete/", {"image_key": key}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.avatar_url, "")
        self.assertEqual(resp.json().get("detached_avatar_count"), 1)
        client.delete_object.assert_called_once_with(Bucket="bucket", Key=key)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    def test_image_delete_rejects_key_outside_owner_prefix(self):
        bad_key = f"closet/{self.borrower.id}/20240101/nope.jpg"
        resp = self.owner_client.post(
            "/api/v1/closet/images/delete/",
            {"image_key": bad_key},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet", CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test")
    @patch("closet.views._build_r2_client")
    def test_images_mine_sets_cache_control_private_no_store(self, build_client_mock):
        build_client_mock.return_value.list_objects_v2.return_value = {
            "Contents": [],
            "IsTruncated": False,
        }
        with patch.dict(
            "os.environ",
            {
                "CLOUDFLARE_ACCOUNT_ID": "acct",
                "CLOSET_R2_BUCKET": "bucket",
                "CLOSET_R2_ACCESS_KEY_ID": "ak",
                "CLOSET_R2_SECRET_ACCESS_KEY": "sk",
            },
            clear=False,
        ):
            resp = self.owner_client.get("/api/v1/closet/images/")
        self.assertEqual(resp.status_code, 200)
        cc = (resp.headers.get("Cache-Control") or "").lower()
        self.assertIn("no-store", cc)
        self.assertIn("private", cc)

    @override_settings(CLOSET_R2_KEY_PREFIX="closet")
    def test_closet_image_key_owned_by_user_requires_exact_user_segment(self):
        self.assertTrue(closet_image_key_owned_by_user("closet/7/20240101/x.jpg", 7))
        self.assertFalse(closet_image_key_owned_by_user("closet/77/20240101/x.jpg", 7))
        self.assertFalse(closet_image_key_owned_by_user("closet/7extra/20240101/x.jpg", 7))
        self.assertFalse(closet_image_key_owned_by_user("closet/07/20240101/x.jpg", 7))

    @override_settings(CLOSET_R2_KEY_PREFIX="app/closet")
    def test_closet_image_key_owned_by_user_multisegment_root(self):
        self.assertTrue(closet_image_key_owned_by_user("app/closet/3/20240101/x.jpg", 3))
        self.assertFalse(closet_image_key_owned_by_user("app/closet/33/20240101/x.jpg", 3))

    @override_settings(CLOSET_R2_KEY_PREFIX="closet", CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test")
    @patch("closet.views._list_user_bucket_keys")
    @patch("closet.views._build_r2_client")
    def test_images_inventory_drops_bucket_keys_failing_segment_check(
        self, build_client_mock, list_bucket_keys_mock
    ):
        """Defense-in-depth: filter keys even if storage listing returns unexpected objects."""
        good = f"closet/{self.owner.id}/20240101/ok.jpg"
        bad_digit_suffix = f"closet/{self.owner.id}0/20240101/leak.jpg"
        list_bucket_keys_mock.return_value = {good, bad_digit_suffix}
        with patch.dict(
            "os.environ",
            {
                "CLOUDFLARE_ACCOUNT_ID": "acct",
                "CLOSET_R2_BUCKET": "bucket",
                "CLOSET_R2_ACCESS_KEY_ID": "ak",
                "CLOSET_R2_SECRET_ACCESS_KEY": "sk",
            },
            clear=False,
        ):
            resp = self.owner_client.get("/api/v1/closet/images/")
        self.assertEqual(resp.status_code, 200)
        keys = {row["image_key"] for row in resp.json()["results"]}
        self.assertIn(good, keys)
        self.assertNotIn(bad_digit_suffix, keys)

