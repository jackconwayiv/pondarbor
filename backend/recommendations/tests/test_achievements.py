from django.test import TestCase

from achievements.models import AchievementDefinition, UserAchievement
from achievements.services import (
    SLUG_RECOMMENDATIONS_AND_ALSO,
    SLUG_RECOMMENDATIONS_FIVE_STARS,
    SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES,
    evaluate_recommendations_achievements_for_user,
)
from recommendations.models import Entry, RecommendationCategory, Review
from recommendations.services import normalize_link
from users.models import User


class RecommendationsAchievementTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="alice@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        self.other = User.objects.create_user(
            email="bob@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        self.films = RecommendationCategory.objects.get(slug="films")
        for slug, title in (
            (SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES, "10/10 No Notes"),
            (SLUG_RECOMMENDATIONS_AND_ALSO, "And Also..."),
            (SLUG_RECOMMENDATIONS_FIVE_STARS, "Five Stars"),
        ):
            AchievementDefinition.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "description": "",
                    "category": "recommendations",
                    "order": 240,
                },
            )

    def _entry_with_review(self, *, creator, reviewer, title="Test"):
        entry = Entry.objects.create(
            category=self.films,
            title=title,
            link="",
            link_normalized="",
            created_by=creator,
        )
        Review.objects.create(
            entry=entry,
            reviewer=reviewer,
            rating="4",
            body="Nice",
            date_recommended="2026-01-01",
        )
        return entry

    def test_entry_create_unlocks_share_badge(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "films",
                "title": "Inception",
                "rating": 4,
                "body": "Great",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES,
            ).exists()
        )

    def test_review_on_other_entry_unlocks_and_also(self):
        from rest_framework.test import APIClient

        entry = self._entry_with_review(creator=self.other, reviewer=self.other, title="Bob film")
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.post(
            f"/api/v1/recommendations/entries/{entry.id}/reviews/",
            {"rating": 5, "body": "Agreed"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_AND_ALSO,
            ).exists()
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES,
            ).exists()
        )

    def test_merge_onto_other_entry_unlocks_and_also_not_share(self):
        from rest_framework.test import APIClient

        link = "https://example.com/shared-place"
        Entry.objects.create(
            category=self.films,
            title="Existing",
            link=link,
            link_normalized=normalize_link(link),
            created_by=self.other,
        )
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "films",
                "title": "Existing",
                "link": link,
                "rating": 4,
                "body": "My take",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["merged"])
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_AND_ALSO,
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES,
            ).exists()
        )

    def test_five_stars_after_fifth_rating(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)
        for idx in range(5):
            resp = client.post(
                "/api/v1/recommendations/entries/",
                {
                    "category_slug": "films",
                    "title": f"Film {idx}",
                    "link": f"https://example.com/film-{idx}",
                    "rating": 4,
                    "body": "Good",
                },
                format="json",
            )
            self.assertIn(resp.status_code, (200, 201))
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_FIVE_STARS,
            ).exists()
        )

    def test_backfill_grants_existing_unlocks(self):
        self._entry_with_review(creator=self.user, reviewer=self.user, title="Mine")
        self._entry_with_review(creator=self.other, reviewer=self.user, title="Theirs 1")
        self._entry_with_review(creator=self.other, reviewer=self.user, title="Theirs 2")
        self._entry_with_review(creator=self.other, reviewer=self.user, title="Theirs 3")
        self._entry_with_review(creator=self.other, reviewer=self.user, title="Theirs 4")

        evaluate_recommendations_achievements_for_user(self.user.id)

        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES,
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_AND_ALSO,
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_RECOMMENDATIONS_FIVE_STARS,
            ).exists()
        )
