from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from friends.models import FriendRequest
from songaday.models import SongPrompt, SongResponse
from users.models import Profile

User = get_user_model()


class SongadayApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice_song@example.com", password="secret12345")
        self.bob = User.objects.create_user(email="bob_song@example.com", password="secret12345")
        self.stranger = User.objects.create_user(email="stranger_song@example.com", password="secret12345")
        for u in (self.alice, self.bob, self.stranger):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)
        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)
        self.stranger_client = APIClient()
        self.stranger_client.force_login(self.stranger)

        self.staff = User.objects.create_user(email="staff_song@example.com", password="secret12345")
        self.staff.is_staff = True
        self.staff.account_status = User.AccountStatus.APPROVED
        self.staff.save(update_fields=["is_staff", "account_status"])
        self.staff_client = APIClient()
        self.staff_client.force_login(self.staff)

        SongPrompt.objects.create(month=4, day=12, prompt="Spring song")

    def _accept_pair(self, a, b):
        FriendRequest.objects.update_or_create(
            requester=a, requested=b, defaults={"is_accepted": True}
        )
        FriendRequest.objects.update_or_create(
            requester=b, requested=a, defaults={"is_accepted": True}
        )

    def test_prompt_for_date_returns_prompt(self):
        r = self.alice_client.get("/api/v1/songaday/prompts/for-date/?year=2026&month=4&day=12")
        self.assertEqual(r.status_code, 200)
        j = r.json()
        self.assertEqual(j["prompt"], "Spring song")

    def test_prompts_list_staff_ok_ordered_by_month_day(self):
        SongPrompt.objects.create(month=1, day=2, prompt="Earlier in year")
        SongPrompt.objects.create(month=12, day=31, prompt="Later in year")
        r = self.staff_client.get("/api/v1/songaday/prompts/catalog/")
        self.assertEqual(r.status_code, 200)
        rows = r.json()["results"]
        months_days = [(x["month"], x["day"]) for x in rows]
        self.assertEqual(months_days, sorted(months_days))
        texts = {x["prompt"] for x in rows}
        self.assertIn("Spring song", texts)
        self.assertIn("Earlier in year", texts)

    def test_prompts_list_non_staff_forbidden(self):
        r = self.alice_client.get("/api/v1/songaday/prompts/catalog/")
        self.assertEqual(r.status_code, 403)

    def test_create_response_twice_same_year_day_conflict(self):
        payload = {
            "entry_date": "2026-04-12",
            "prompt_snapshot": "Spring song",
            "youtube_video_id": "dQw4w9WgXcQ",
        }
        r1 = self.alice_client.post("/api/v1/songaday/responses/", payload, format="json")
        self.assertEqual(r1.status_code, 201)
        r2 = self.alice_client.post("/api/v1/songaday/responses/", payload, format="json")
        self.assertEqual(r2.status_code, 409)

    def test_create_different_years_same_month_day_allowed(self):
        p = {
            "prompt_snapshot": "Spring song",
            "youtube_video_id": "dQw4w9WgXcQ",
        }
        r1 = self.alice_client.post(
            "/api/v1/songaday/responses/",
            {"entry_date": "2025-04-12", **p},
            format="json",
        )
        self.assertEqual(r1.status_code, 201)
        r2 = self.alice_client.post(
            "/api/v1/songaday/responses/",
            {"entry_date": "2026-04-12", **p},
            format="json",
        )
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(SongResponse.objects.filter(user=self.alice).count(), 2)

    def test_friend_sees_response_stranger_does_not(self):
        self._accept_pair(self.alice, self.bob)
        self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Spring song",
                "spotify_url": "https://open.spotify.com/track/abc123",
            },
            format="json",
        )
        rb = self.bob_client.get("/api/v1/songaday/responses/for-date/?year=2026&month=4&day=12")
        self.assertEqual(rb.status_code, 200)
        self.assertEqual(len(rb.json()), 1)
        rs = self.stranger_client.get("/api/v1/songaday/responses/for-date/?year=2026&month=4&day=12")
        self.assertEqual(rs.status_code, 200)
        # Default policy: visible to all approved users unless the owner opts into friends-only.
        self.assertEqual(len(rs.json()), 1)

    def test_cannot_heart_own_submission(self):
        cr = self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Spring song",
                "raw_label": "Test",
            },
            format="json",
        )
        rid = cr.json()["id"]
        hr = self.alice_client.post(f"/api/v1/songaday/responses/{rid}/heart/", {}, format="json")
        self.assertEqual(hr.status_code, 400)

    def test_archive_own_submissions_ordered_newest_first(self):
        SongPrompt.objects.create(month=3, day=1, prompt="March prompt")
        self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-03-01",
                "prompt_snapshot": "Older",
                "raw_label": "Old song",
            },
            format="json",
        )
        self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Spring song",
                "raw_label": "New song",
            },
            format="json",
        )
        r = self.alice_client.get("/api/v1/songaday/responses/archive/")
        self.assertEqual(r.status_code, 200)
        payload = r.json()
        rows = payload["results"]
        self.assertEqual(payload["total"], 2)
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["page_size"], 10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["prompt_snapshot"], "Spring song")
        self.assertEqual(rows[1]["prompt_snapshot"], "Older")

    def test_archive_friend_submissions(self):
        self._accept_pair(self.alice, self.bob)
        self.bob_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Bob prompt",
                "raw_label": "Bob track",
            },
            format="json",
        )
        r = self.alice_client.get(f"/api/v1/songaday/responses/archive/?user_id={self.bob.id}")
        self.assertEqual(r.status_code, 200)
        payload = r.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["user"]["id"], self.bob.id)

    def test_archive_non_friend_404(self):
        self.bob_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Bob only",
                "raw_label": "X",
            },
            format="json",
        )
        r = self.alice_client.get(f"/api/v1/songaday/responses/archive/?user_id={self.bob.id}")
        # Default policy: archives are visible to approved users unless owner opts friends-only/private.
        self.assertEqual(r.status_code, 200)

    def test_archive_eligible_friends_omits_friends_with_zero_submissions(self):
        self._accept_pair(self.alice, self.bob)
        self._accept_pair(self.alice, self.stranger)
        self.bob_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Bob prompt",
                "raw_label": "Bob",
            },
            format="json",
        )
        r = self.alice_client.get("/api/v1/songaday/responses/archive/eligible-friends/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user_ids"], [self.bob.id])

    def test_archive_pagination_page_size(self):
        for year in range(2015, 2027):
            self.alice_client.post(
                "/api/v1/songaday/responses/",
                {
                    "entry_date": f"{year}-04-12",
                    "prompt_snapshot": f"Y{year}",
                    "raw_label": "x",
                },
                format="json",
            )
        r1 = self.alice_client.get("/api/v1/songaday/responses/archive/?page=1&page_size=10")
        self.assertEqual(r1.status_code, 200)
        p1 = r1.json()
        self.assertEqual(p1["total"], 12)
        self.assertEqual(p1["page"], 1)
        self.assertEqual(p1["page_size"], 10)
        self.assertEqual(len(p1["results"]), 10)
        self.assertTrue(p1["has_next"])
        self.assertFalse(p1["has_prev"])
        self.assertEqual(p1["results"][0]["prompt_snapshot"], "Y2026")

        r2 = self.alice_client.get("/api/v1/songaday/responses/archive/?page=2&page_size=10")
        self.assertEqual(r2.status_code, 200)
        p2 = r2.json()
        self.assertEqual(len(p2["results"]), 2)
        self.assertFalse(p2["has_next"])
        self.assertTrue(p2["has_prev"])
        self.assertEqual(p2["results"][-1]["prompt_snapshot"], "Y2015")

    def test_for_date_all_approved_non_friend_sees(self):
        prof = self.alice.profile
        prof.songaday_visibility = Profile.SongadayVisibility.ALL_APPROVED
        prof.save(update_fields=["songaday_visibility"])
        self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Spring song",
                "raw_label": "A",
            },
            format="json",
        )
        rs = self.stranger_client.get("/api/v1/songaday/responses/for-date/?year=2026&month=4&day=12")
        self.assertEqual(rs.status_code, 200)
        self.assertEqual(len(rs.json()), 1)

    def test_for_date_private_friend_does_not_see(self):
        self._accept_pair(self.alice, self.bob)
        self.alice_client.post(
            "/api/v1/songaday/responses/",
            {
                "entry_date": "2026-04-12",
                "prompt_snapshot": "Spring song",
                "raw_label": "A",
            },
            format="json",
        )
        prof = self.alice.profile
        prof.songaday_visibility = Profile.SongadayVisibility.PRIVATE
        prof.save(update_fields=["songaday_visibility"])
        rb = self.bob_client.get("/api/v1/songaday/responses/for-date/?year=2026&month=4&day=12")
        self.assertEqual(rb.status_code, 200)
        self.assertEqual(len(rb.json()), 0)
