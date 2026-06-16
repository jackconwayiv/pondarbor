from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from recommendations.models import Entry, RecommendationCategory, Review
from recommendations.services import normalize_link
from users.models import User


class RecommendationsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
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
        self.client.force_authenticate(user=self.user)
        self.films = RecommendationCategory.objects.get(slug="films")
        self.restaurants = RecommendationCategory.objects.get(slug="restaurants")

    def _create_entry_with_review(
        self,
        *,
        link="",
        category=None,
        user=None,
        rating="4.5",
        body="Great",
        location_label="",
    ):
        category = category or self.films
        user = user or self.user
        entry = Entry.objects.create(
            category=category,
            title="Test Place",
            link=link,
            link_normalized=normalize_link(link),
            location_label=location_label,
            created_by=user,
        )
        Review.objects.create(
            entry=entry,
            reviewer=user,
            rating=rating,
            body=body,
            date_recommended="2026-01-01",
        )
        return entry

    def test_create_entry_and_review(self):
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "films",
                "title": "Inception",
                "link": "https://imdb.com/title/tt1375666",
                "rating": 4.5,
                "body": "Mind-bending",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.data["merged"])
        self.assertEqual(Entry.objects.count(), 1)
        self.assertEqual(Review.objects.count(), 1)

    def test_soft_merge_duplicate_link(self):
        self._create_entry_with_review(
            link="https://example.com/place",
            category=self.restaurants,
            user=self.other,
        )
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "films",
                "title": "Ignored title",
                "link": "https://example.com/place/",
                "rating": 3.47,
                "body": "My take",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["merged"])
        self.assertEqual(resp.data["message"], "An entry already exists.")
        self.assertEqual(Entry.objects.count(), 1)
        self.assertEqual(Review.objects.count(), 2)

    def test_rating_validation(self):
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "films",
                "title": "Bad rating",
                "rating": 0.5,
                "body": "Nope",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_review_without_body(self):
        entry = self._create_entry_with_review()
        review = Review.objects.get(entry=entry, reviewer=self.user)
        resp = self.client.patch(
            f"/api/v1/recommendations/reviews/{review.id}/",
            {"rating": 2.5},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        review.refresh_from_db()
        self.assertEqual(float(review.rating), 2.5)
        self.assertEqual(review.body, "Great")
        self.assertIsNotNone(review.edited_at)

    def test_patch_review_rating_and_body(self):
        entry = self._create_entry_with_review(rating="4", body="Original comment")
        review = Review.objects.get(entry=entry, reviewer=self.user)
        resp = self.client.patch(
            f"/api/v1/recommendations/reviews/{review.id}/",
            {"rating": 5, "body": "Updated comment"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["body"], "Updated comment")
        self.assertEqual(float(resp.data["rating"]), 5)
        self.assertIsNotNone(resp.data["edited_at"])
        review.refresh_from_db()
        self.assertEqual(review.body, "Updated comment")
        self.assertEqual(float(review.rating), 5)

    def test_patch_review_reflected_on_entry_detail(self):
        entry = self._create_entry_with_review(body="Before edit")
        review = Review.objects.get(entry=entry, reviewer=self.user)
        self.client.patch(
            f"/api/v1/recommendations/reviews/{review.id}/",
            {"rating": 3, "body": "After edit"},
            format="json",
        )
        detail = self.client.get(f"/api/v1/recommendations/entries/{entry.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["viewer_review_id"], review.id)
        mine = next(r for r in detail.data["reviews"] if r["id"] == review.id)
        self.assertEqual(mine["body"], "After edit")
        self.assertEqual(float(mine["rating"]), 3)
        self.assertIsNotNone(mine["edited_at"])

    def test_patch_review_leaves_other_reviewers_unchanged(self):
        entry = Entry.objects.create(
            category=self.films,
            title="Shared film",
            link="",
            link_normalized="",
            created_by=self.other,
        )
        other_review = Review.objects.create(
            entry=entry,
            reviewer=self.other,
            rating="4",
            body="Bob's take",
            date_recommended="2026-01-01",
        )
        my_review = Review.objects.create(
            entry=entry,
            reviewer=self.user,
            rating="5",
            body="Alice first take",
            date_recommended="2026-01-02",
        )
        resp = self.client.patch(
            f"/api/v1/recommendations/reviews/{my_review.id}/",
            {"rating": 2, "body": "Alice revised take"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        other_review.refresh_from_db()
        my_review.refresh_from_db()
        self.assertEqual(other_review.body, "Bob's take")
        self.assertEqual(float(other_review.rating), 4)
        self.assertIsNone(other_review.edited_at)
        self.assertEqual(my_review.body, "Alice revised take")
        self.assertEqual(float(my_review.rating), 2)
        self.assertIsNotNone(my_review.edited_at)

    def test_patch_review_forbidden_for_other_users_review(self):
        entry = self._create_entry_with_review(user=self.other, body="Bob only")
        review = Review.objects.get(entry=entry, reviewer=self.other)
        resp = self.client.patch(
            f"/api/v1/recommendations/reviews/{review.id}/",
            {"rating": 1, "body": "Hijacked"},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)
        review.refresh_from_db()
        self.assertEqual(review.body, "Bob only")

    @mock.patch("recommendations.geocode.reverse_geocode_coords")
    def test_create_entry_infers_location_label(self, mock_rev):
        mock_rev.return_value = {
            "formatted_address": "123 N Central Ave, Phoenix, AZ 85004, USA",
            "place_id": "ChIJphx",
        }
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "restaurants",
                "title": "Arizona Biltmore",
                "latitude": "33.519",
                "longitude": "-112.026",
                "rating": 4,
                "body": "Lovely spot",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["entry"]["location_label"], "phoenix")
        entry = Entry.objects.get(pk=resp.data["entry"]["id"])
        self.assertEqual(entry.location_label, "phoenix")

    def test_create_entry_rounds_high_precision_coordinates(self):
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "restaurants",
                "title": "China Chili",
                "address": "302 E Flower St, Phoenix, AZ 85012",
                "latitude": "33.44837291826191",
                "longitude": "-112.07403728471582",
                "rating": 4,
                "body": "Great spot",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        entry = Entry.objects.get(pk=resp.data["entry"]["id"])
        self.assertEqual(str(entry.latitude), "33.448373")
        self.assertEqual(str(entry.longitude), "-112.074037")

    def test_links_category_exists(self):
        resp = self.client.get("/api/v1/recommendations/categories/")
        self.assertEqual(resp.status_code, 200)
        links = next((row for row in resp.data if row["slug"] == "links"), None)
        self.assertIsNotNone(links)
        self.assertEqual(links["group"], "links")
        self.assertEqual(links["emoji"], "🔗")

    def test_create_links_entry(self):
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "links",
                "title": "Interesting article",
                "link": "https://example.com/article",
                "image_url": "https://example.com/og.jpg",
                "rating": 4,
                "body": "Worth a read",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        entry = Entry.objects.get(pk=resp.data["entry"]["id"])
        self.assertEqual(entry.category.slug, "links")
        self.assertEqual(entry.link, "https://example.com/article")
        self.assertEqual(entry.image_url, "https://example.com/og.jpg")

    @mock.patch("recommendations.geocode._google_geocode")
    def test_create_place_geocodes_address_without_coords(self, mock_geo):
        mock_geo.return_value = {
            "lat": "33.448373",
            "lng": "-112.074037",
            "formatted_address": "302 E Flower St, Phoenix, AZ 85012, USA",
            "place_id": "ChIJtest",
        }
        resp = self.client.post(
            "/api/v1/recommendations/entries/",
            {
                "category_slug": "restaurants",
                "title": "China Chili",
                "address": "302 E Flower St, Phoenix, AZ 85012",
                "rating": 4,
                "body": "Great spot",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        entry = Entry.objects.get(pk=resp.data["entry"]["id"])
        self.assertEqual(str(entry.latitude), "33.448373")
        self.assertEqual(str(entry.longitude), "-112.074037")

    def test_category_entries_list(self):
        self._create_entry_with_review()
        self._create_entry_with_review(location_label="phoenix")
        resp = self.client.get("/api/v1/recommendations/categories/films/entries/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)
