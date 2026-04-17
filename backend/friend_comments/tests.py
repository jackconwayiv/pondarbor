from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from achievements.models import UserAchievement
from friends.models import FriendRequest
from songaday.models import SongPrompt, SongResponse
from users.models import Profile

User = get_user_model()


class FriendCommentsApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice_fc@example.com", password="secret12345")
        self.bob = User.objects.create_user(email="bob_fc@example.com", password="secret12345")
        for u in (self.alice, self.bob):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        self._accept_pair(self.alice, self.bob)
        SongPrompt.objects.create(month=4, day=12, prompt="Spring song")
        prompt = SongPrompt.objects.get(month=4, day=12)
        self.response = SongResponse.objects.create(
            user=self.alice,
            prompt=prompt,
            entry_date=date(2026, 4, 12),
            prompt_snapshot="Spring song",
            notes="Hi",
            youtube_video_id="dQw4w9WgXcQ",
        )
        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)
        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)

    def _accept_pair(self, a, b):
        FriendRequest.objects.update_or_create(
            requester=a, requested=b, defaults={"is_accepted": True}
        )
        FriendRequest.objects.update_or_create(
            requester=b, requested=a, defaults={"is_accepted": True}
        )

    def test_bob_can_post_and_list_comment(self):
        q = f"target_type=songaday.songresponse&object_id={self.response.id}"
        r = self.bob_client.post(
            f"/api/v1/friend-comments/?{q}",
            {"body": "Nice pick!"},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["body"], "Nice pick!")
        r2 = self.bob_client.get(f"/api/v1/friend-comments/?{q}")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(len(r2.json()), 1)

    def test_private_owner_blocks_bob_comments_list(self):
        prof = self.alice.profile
        prof.songaday_visibility = Profile.SongadayVisibility.PRIVATE
        prof.save(update_fields=["songaday_visibility"])
        q = f"target_type=songaday.songresponse&object_id={self.response.id}"
        r = self.bob_client.get(f"/api/v1/friend-comments/?{q}")
        self.assertEqual(r.status_code, 404)

    def _post_comment(self, client, response_id: int, body: str = "Nice"):
        q = f"target_type=songaday.songresponse&object_id={response_id}"
        return client.post(f"/api/v1/friend-comments/?{q}", {"body": body}, format="json")

    def _alice_response(self, *, month: int, day: int) -> SongResponse:
        prompt, _ = SongPrompt.objects.get_or_create(
            month=month,
            day=day,
            defaults={"prompt": f"Prompt {month}-{day}"},
        )
        return SongResponse.objects.create(
            user=self.alice,
            prompt=prompt,
            entry_date=date(2026, month, day),
            prompt_snapshot=prompt.prompt,
            notes="",
            youtube_video_id="dQw4w9WgXcQ",
        )

    def test_musically_multiloquent_unlocks_after_tenth_distinct_friend_post(self):
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )
        for i in range(10):
            r = self._alice_response(month=2, day=i + 1)
            resp = self._post_comment(self.bob_client, r.id, body=f"c{i}")
            self.assertEqual(resp.status_code, 201, resp.content)
            if i < 9:
                self.assertFalse(
                    UserAchievement.objects.filter(
                        user=self.bob, achievement__slug="musically_multiloquent"
                    ).exists()
                )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )

    def test_musically_multiloquent_duplicate_comments_same_post_count_once(self):
        r1 = self._alice_response(month=3, day=1)
        for i in range(2, 11):
            self._alice_response(month=3, day=i)
        self._post_comment(self.bob_client, r1.id, body="first")
        self._post_comment(self.bob_client, r1.id, body="second")
        for i in range(2, 10):
            rid = SongResponse.objects.get(user=self.alice, entry_date=date(2026, 3, i)).id
            self._post_comment(self.bob_client, rid, body="x")
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )
        last = SongResponse.objects.get(user=self.alice, entry_date=date(2026, 3, 10))
        self._post_comment(self.bob_client, last.id, body="last")
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )

    def test_musically_multiloquent_own_submission_comments_do_not_count(self):
        bob_prompt, _ = SongPrompt.objects.get_or_create(
            month=5, day=1, defaults={"prompt": "Bob prompt"}
        )
        bob_own = SongResponse.objects.create(
            user=self.bob,
            prompt=bob_prompt,
            entry_date=date(2026, 5, 1),
            prompt_snapshot="Bob prompt",
            notes="",
            youtube_video_id="abc12345",
        )
        for i in range(9):
            r = self._alice_response(month=6, day=i + 1)
            self._post_comment(self.bob_client, r.id, body="c")
        self._post_comment(self.bob_client, bob_own.id, body="on mine")
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )
        r10 = self._alice_response(month=6, day=10)
        self._post_comment(self.bob_client, r10.id, body="ten")
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.bob, achievement__slug="musically_multiloquent"
            ).exists()
        )
