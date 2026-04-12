"""Tests for song link metadata resolution (mocked HTTP)."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from songaday.resolve_link import (
    ResolveError,
    _clean_apple_og_title_noise,
    resolve_from_youtube_video_id,
    resolve_song_link_metadata,
)

User = get_user_model()


class ResolveLinkUnitTests(TestCase):
    def test_clean_apple_og_title_strips_noise_and_mojibake(self):
        raw = "Yes on Apple\u00c2 Music — Owner of a Lonely Heart"
        self.assertEqual(_clean_apple_og_title_noise(raw), "Yes — Owner of a Lonely Heart")

    @mock.patch("songaday.resolve_link._SESSION.get")
    def test_youtube_oembed_returns_author_and_title(self, mock_get):
        mock_resp = mock.Mock()
        mock_resp.json.return_value = {
            "title": "Never Gonna Give You Up",
            "author_name": "Rick Astley",
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        a, t, src = resolve_song_link_metadata("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertEqual(src, "youtube")
        self.assertEqual(a, "Rick Astley")
        self.assertEqual(t, "Never Gonna Give You Up")

    @mock.patch("songaday.resolve_link._SESSION.get")
    def test_spotify_oembed_splits_middle_dot(self, mock_get):
        mock_resp = mock.Mock()
        mock_resp.json.return_value = {"title": "Track Name · Artist Name"}
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        a, t, src = resolve_song_link_metadata("https://open.spotify.com/track/abc123")
        self.assertEqual(src, "spotify")
        self.assertEqual(a, "Artist Name")
        self.assertEqual(t, "Track Name")
        self.assertEqual(mock_get.call_count, 1)

    @mock.patch("songaday.resolve_link._SESSION.get")
    def test_spotify_fetches_page_when_oembed_has_track_only(self, mock_get):
        oembed_resp = mock.Mock()
        oembed_resp.json.return_value = {"title": "Cut To The Feeling"}
        oembed_resp.raise_for_status.return_value = None
        page_resp = mock.Mock()
        page_resp.text = (
            "<!DOCTYPE html><title>"
            "Cut To The Feeling - song and lyrics by Carly Rae Jepsen | Spotify"
            "</title>"
        )
        page_resp.content = page_resp.text.encode()
        page_resp.raise_for_status.return_value = None
        mock_get.side_effect = [oembed_resp, page_resp]

        a, t, src = resolve_song_link_metadata("https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl")
        self.assertEqual(src, "spotify")
        self.assertEqual(a, "Carly Rae Jepsen")
        self.assertEqual(t, "Cut To The Feeling")
        self.assertEqual(mock_get.call_count, 2)

    @mock.patch("songaday.resolve_link._SESSION.get")
    def test_apple_music_parses_og_title(self, mock_get):
        html = '<html><head><meta property="og:title" content="Hello &amp; Hi - Band Name" />'
        mock_resp = mock.Mock()
        mock_resp.text = html
        mock_resp.content = html.encode()
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        a, t, src = resolve_song_link_metadata("https://music.apple.com/us/album/foo/123")
        self.assertEqual(src, "apple")
        self.assertTrue(t or a)

    def test_resolve_from_youtube_video_id_rejects_bad_id(self):
        with self.assertRaises(ResolveError):
            resolve_from_youtube_video_id("bad id!!!")


class ResolveLinkApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="resolve@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.client = APIClient()
        self.client.force_login(self.user)

    @mock.patch("songaday.views.resolve_song_link_metadata")
    def test_resolve_endpoint_ok(self, mock_resolve):
        mock_resolve.return_value = ("Artist", "Title", "youtube")
        r = self.client.post(
            "/api/v1/songaday/resolve-link/",
            {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        j = r.json()
        self.assertEqual(j["artist"], "Artist")
        self.assertEqual(j["title"], "Title")
        self.assertEqual(j["source"], "youtube")

    def test_resolve_endpoint_requires_auth(self):
        c = APIClient()
        r = c.post("/api/v1/songaday/resolve-link/", {"youtube_video_id": "dQw4w9WgXcQ"}, format="json")
        self.assertEqual(r.status_code, 403)
