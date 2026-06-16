from django.test import TestCase
from rest_framework.test import APIClient

from friends.models import FriendRequest
from recommendations.models import Entry, RecommendationCategory, Review
from recommendations.services import normalize_link
from users.models import User


class FriendRecommendationsBrowseTests(TestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            email="viewer@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        self.stranger = User.objects.create_user(
            email="stranger@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        FriendRequest.objects.create(
            requester=self.viewer,
            requested=self.owner,
            is_accepted=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.viewer)
        self.films = RecommendationCategory.objects.get(slug="films")

    def _owner_review(self, *, title="Film", link="https://example.com/a"):
        entry = Entry.objects.create(
            category=self.films,
            title=title,
            link=link,
            link_normalized=normalize_link(link),
            created_by=self.owner,
        )
        Review.objects.create(
            entry=entry,
            reviewer=self.owner,
            rating="4.5",
            body="Loved it",
            date_recommended="2026-01-01",
        )
        return entry

    def test_friend_can_list_owner_reviews(self):
        self._owner_review()
        resp = self.client.get(f"/api/v1/recommendations/reviews/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["body"], "Loved it")
        self.assertEqual(resp.data[0]["entry"]["title"], "Film")

    def test_non_friend_forbidden(self):
        self._owner_review()
        self.client.force_authenticate(user=self.stranger)
        resp = self.client.get(f"/api/v1/recommendations/reviews/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_self_browse_rejected(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(f"/api/v1/recommendations/reviews/friends/{self.owner.id}/")
        self.assertEqual(resp.status_code, 400)
