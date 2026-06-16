from unittest import mock

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from recommendations.geocode import resolve_coordinates_pair, resolve_place_query, split_name_and_address
from users.models import User


class GeocodeUnitTests(SimpleTestCase):
    def test_split_name_and_address(self):
        title, address = split_name_and_address(
            "Desert Cave Mexican Food, 37611 N Cave Creek Rd, Cave Creek, AZ 85331"
        )
        self.assertEqual(title, "Desert Cave Mexican Food")
        self.assertEqual(address, "37611 N Cave Creek Rd, Cave Creek, AZ 85331")

    @mock.patch("recommendations.geocode._google_geocode")
    def test_resolve_place_query_geocoded(self, mock_geo):
        mock_geo.return_value = {
            "lat": "33.8476",
            "lng": "-111.9789",
            "formatted_address": "37611 N Cave Creek Rd, Cave Creek, AZ 85331, USA",
            "place_id": "ChIJtest",
        }
        result = resolve_place_query(
            "Desert Cave Mexican Food, 37611 N Cave Creek Rd, Cave Creek, AZ 85331"
        )
        self.assertEqual(result["title"], "Desert Cave Mexican Food")
        self.assertEqual(result["latitude"], "33.8476")
        self.assertEqual(result["longitude"], "-111.9789")
        self.assertEqual(result["google_place_id"], "ChIJtest")
        self.assertEqual(result["category_slug"], "restaurants")

    @mock.patch("recommendations.geocode.reverse_geocode_coords")
    def test_resolve_coordinates_pair_infers_label(self, mock_rev):
        mock_rev.return_value = {
            "formatted_address": "7014 E Camelback Rd, Scottsdale, AZ 85251, USA",
            "place_id": "ChIJtest",
        }
        result = resolve_coordinates_pair("33.502", "-111.929")
        self.assertEqual(result["latitude"], "33.502000")
        self.assertEqual(result["location_label"], "scottsdale")
        self.assertIn("Scottsdale", result["hints"][1])


class GeocodeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="alice@example.com",
            password="x",
            account_status=User.AccountStatus.APPROVED,
        )
        self.client.force_authenticate(user=self.user)

    @mock.patch("recommendations.geocode._google_geocode")
    def test_resolve_link_accepts_place_address(self, mock_geo):
        mock_geo.return_value = {
            "lat": "33.8476",
            "lng": "-111.9789",
            "formatted_address": "37611 N Cave Creek Rd, Cave Creek, AZ 85331, USA",
            "place_id": "ChIJtest",
        }
        resp = self.client.post(
            "/api/v1/recommendations/resolve-link/",
            {
                "url": "Desert Cave Mexican Food, 37611 N Cave Creek Rd, Cave Creek, AZ 85331",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["title"], "Desert Cave Mexican Food")
        self.assertEqual(resp.data["latitude"], "33.8476")
