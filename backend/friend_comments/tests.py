from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

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
