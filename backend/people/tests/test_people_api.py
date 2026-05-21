from concurrent.futures import ThreadPoolExecutor, as_completed

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from achievements.models import AchievementDefinition, UserAchievement
from friends.models import FriendRequest
from people.models import Person
from users.models import Profile

User = get_user_model()


class PeopleApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="secret12345")
        self.friend = User.objects.create_user(email="friend@example.com", password="secret12345")
        self.stranger = User.objects.create_user(email="stranger@example.com", password="secret12345")
        for u in (self.owner, self.friend, self.stranger):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        Profile.objects.update_or_create(
            user=self.owner,
            defaults={"display_name": "Owner Nick", "social_publish_visibility": Profile.SocialPublishVisibility.FRIENDS_ONLY},
        )
        Profile.objects.update_or_create(user=self.friend, defaults={"display_name": "Friend"})
        Profile.objects.update_or_create(user=self.stranger, defaults={"display_name": "Stranger"})
        FriendRequest.objects.update_or_create(
            requester=self.owner,
            requested=self.friend,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=self.friend,
            requested=self.owner,
            defaults={"is_accepted": True},
        )
        AchievementDefinition.objects.update_or_create(
            slug="familial_arborist",
            defaults={
                "title": "Familial Arborist",
                "description": "Test",
                "category": "people",
                "order": 140,
            },
        )
        self.owner_client = APIClient()
        self.owner_client.force_login(self.owner)
        self.friend_client = APIClient()
        self.friend_client.force_login(self.friend)
        self.stranger_client = APIClient()
        self.stranger_client.force_login(self.stranger)

    def test_get_creates_self_and_returns_bundle(self):
        resp = self.owner_client.get("/api/v1/people/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(len(data["people"]), 1)
        self.assertTrue(data["people"][0]["is_self"])
        self.assertEqual(data["people"][0]["relation_core"], "self")

    def test_friend_can_read_when_friends_only(self):
        self.owner_client.get("/api/v1/people/")
        resp = self.friend_client.get(f"/api/v1/people/users/{self.owner.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("people", resp.json())

    def test_stranger_cannot_read_friends_only_tree(self):
        self.owner_client.get("/api/v1/people/")
        resp = self.stranger_client.get(f"/api/v1/people/users/{self.owner.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_familial_arborist_unlocks_at_ten(self):
        self.owner_client.get("/api/v1/people/")
        # self + 8 = 9 active people; achievement should not unlock yet
        for i in range(8):
            r = self.owner_client.post(
                "/api/v1/people/",
                {
                    "name": f"Relative {i}",
                    "relation_core": "cousin",
                    "relation_prefix_tokens": [],
                    "relation_suffix_tokens": [],
                },
                format="json",
            )
            self.assertEqual(r.status_code, 201, r.content)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.owner,
                achievement__slug="familial_arborist",
            ).exists()
        )
        r = self.owner_client.post(
            "/api/v1/people/",
            {
                "name": "Tenth",
                "relation_core": "brother",
                "relation_prefix_tokens": [],
                "relation_suffix_tokens": [],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.owner,
                achievement__slug="familial_arborist",
            ).exists()
        )

    def test_concurrent_get_does_not_500(self):
        self.owner_client.get("/api/v1/people/")

        def one_get():
            return self.owner_client.get("/api/v1/people/").status_code

        codes = []
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(one_get) for _ in range(12)]
            for fut in as_completed(futures):
                codes.append(fut.result())
        self.assertTrue(all(c == 200 for c in codes), codes)

    def test_create_without_alias_leaves_relation_alias_blank(self):
        self.owner_client.get("/api/v1/people/")
        resp = self.owner_client.post(
            "/api/v1/people/",
            {
                "name": "Sam",
                "relation_core": "brother",
                "relation_prefix_tokens": [],
                "relation_suffix_tokens": ["in_law"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.json()["relation_alias"], "")

    def test_create_with_prefix_tokens(self):
        self.owner_client.get("/api/v1/people/")
        resp = self.owner_client.post(
            "/api/v1/people/",
            {
                "name": "Great Uncle",
                "relation_core": "uncle",
                "relation_prefix_tokens": ["great"],
                "relation_suffix_tokens": ["in_law"],
                "relation_alias": "Unc",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        body = resp.json()
        self.assertEqual(body["relation_prefix_tokens"], ["great"])
        self.assertEqual(body["relation_suffix_tokens"], ["in_law"])

    def test_patch_allows_null_gender_and_self_relation_core(self):
        self.owner_client.get("/api/v1/people/")
        self_id = Person.objects.get(owner_user=self.owner, is_self=True).id
        resp = self.owner_client.patch(
            f"/api/v1/people/{self_id}/",
            {
                "name": "Owner Nick",
                "relation_core": "self",
                "relation_alias": "me",
                "relation_prefix_tokens": [],
                "relation_suffix_tokens": [],
                "birthday": None,
                "death_date": None,
                "gender": None,
                "bio_mother_id": None,
                "bio_father_id": None,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertIsNone(body["gender"])

    def test_layout_patch_and_bundle_includes_layout(self):
        self.owner_client.get("/api/v1/people/")
        people = Person.objects.filter(owner_user=self.owner, deleted_at__isnull=True)
        positions = {str(p.id): {"col": i * 2, "row": 0} for i, p in enumerate(people)}
        payload = {
            "positions": positions,
            "min_col": -2,
            "min_row": -2,
            "max_col": max(6, len(people) * 2),
            "max_row": 2,
        }
        patch_resp = self.owner_client.patch(
            "/api/v1/people/layout/",
            payload,
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200, patch_resp.content)
        get_resp = self.owner_client.get("/api/v1/people/")
        self.assertIn("layout", get_resp.json())
        self.assertEqual(get_resp.json()["layout"]["positions"], positions)

    def test_delete_person_removes_layout_position(self):
        self.owner_client.get("/api/v1/people/")
        created = self.owner_client.post(
            "/api/v1/people/",
            {
                "name": "Temp",
                "relation_core": "brother",
                "relation_prefix_tokens": [],
                "relation_suffix_tokens": [],
            },
            format="json",
        ).json()
        pid = created["id"]
        people = Person.objects.filter(owner_user=self.owner, deleted_at__isnull=True)
        positions = {str(p.id): {"col": i, "row": 0} for i, p in enumerate(people)}
        self.owner_client.patch(
            "/api/v1/people/layout/",
            {
                "positions": positions,
                "min_col": 0,
                "min_row": 0,
                "max_col": len(people) + 2,
                "max_row": 2,
            },
            format="json",
        )
        self.owner_client.delete(f"/api/v1/people/{pid}/")
        layout = self.owner_client.get("/api/v1/people/").json()["layout"]
        self.assertNotIn(pid, layout["positions"])

    def test_cannot_delete_self_person(self):
        self.owner_client.get("/api/v1/people/")
        self_id = Person.objects.get(owner_user=self.owner, is_self=True).id
        resp = self.owner_client.delete(f"/api/v1/people/{self_id}/")
        self.assertEqual(resp.status_code, 400)

    def test_partial_birthday_without_year(self):
        self.owner_client.get("/api/v1/people/")
        created = self.owner_client.post(
            "/api/v1/people/",
            {
                "name": "Mystery Age",
                "relation_core": "cousin",
                "relation_prefix_tokens": [],
                "relation_suffix_tokens": [],
                "birthday": "06-15",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["birthday"], "06-15")

        pid = created.json()["id"]
        patched = self.owner_client.patch(
            f"/api/v1/people/{pid}/",
            {"birthday": "1990-06-15"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["birthday"], "1990-06-15")
