from unittest import mock

from django.test import SimpleTestCase

from recommendations.link_resolve import (
    _enrich_maps_data_with_geocode,
    _expand_maps_url,
    _extract_maps_coords,
    _parse_google_maps_url,
)


class GoogleMapsUrlParseTests(SimpleTestCase):
    def test_prefers_place_pin_from_data_blob_over_viewport_at(self):
        url = (
            "https://www.google.com/maps/@33.48582,-112.06910,12z/data="
            "!4m6!3m5!1s0x872b12261c8c8b55:0xabcdef!8m2!3d33.448373!4d-112.074037"
        )
        lat, lng = _extract_maps_coords(url)
        self.assertEqual(lat, "33.448373")
        self.assertEqual(lng, "-112.074037")

    def test_prefers_place_segment_at_over_leading_viewport(self):
        url = (
            "https://www.google.com/maps/place/China+Chili/"
            "@33.48582,-112.06910,17z/data=!8m2!3d33.448373!4d-112.074037"
        )
        parsed = _parse_google_maps_url(url)
        self.assertEqual(parsed["title"], "China Chili")
        self.assertEqual(parsed["latitude"], "33.448373")
        self.assertEqual(parsed["longitude"], "-112.074037")

    def test_address_like_place_path_sets_address(self):
        url = (
            "https://www.google.com/maps/place/302+E+Flower+St,+Phoenix,+AZ+85012/"
            "@33.48582,-112.06910,17z/data=!8m2!3d33.448373!4d-112.074037"
        )
        parsed = _parse_google_maps_url(url)
        self.assertEqual(parsed["address"], "302 E Flower St, Phoenix, AZ 85012")

    @mock.patch("recommendations.geocode._google_geocode")
    def test_enrich_overwrites_viewport_coords_with_geocode(self, mock_geo):
        mock_geo.return_value = {
            "lat": "33.448373",
            "lng": "-112.074037",
            "formatted_address": "302 E Flower St, Phoenix, AZ 85012, USA",
            "place_id": "ChIJtest",
        }
        enriched = _enrich_maps_data_with_geocode(
            {
                "title": "China Chili",
                "latitude": "33.48582",
                "longitude": "-112.06910",
            }
        )
        self.assertEqual(enriched["latitude"], "33.448373")
        self.assertEqual(enriched["longitude"], "-112.074037")
        self.assertEqual(enriched["address"], "302 E Flower St, Phoenix, AZ 85012, USA")
        mock_geo.assert_called_once_with("China Chili")

    @mock.patch("recommendations.link_resolve.requests.get")
    def test_expand_maps_url_follows_short_link(self, mock_get):
        mock_resp = mock.Mock()
        mock_resp.url = (
            "https://www.google.com/maps/place/China+Chili/"
            "@33.448373,-112.074037,17z/data=!8m2!3d33.448373!4d-112.074037"
        )
        mock_resp.raise_for_status = mock.Mock()
        mock_get.return_value = mock_resp
        expanded = _expand_maps_url("https://maps.app.goo.gl/abc123")
        self.assertIn("China+Chili", expanded)
