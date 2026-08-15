from __future__ import annotations

from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from books.goodreads import (
    discover_shelf_slugs,
    parse_goodreads_user_id,
    parse_shelf_rss,
)

User = get_user_model()

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test bookshelf: read</title>
    <item>
      <title><![CDATA[Joe Country]]></title>
      <link><![CDATA[https://www.goodreads.com/review/show/1]]></link>
      <book_id>123</book_id>
      <book_medium_image_url><![CDATA[https://example.com/cover.jpg]]></book_medium_image_url>
      <author_name>Mick Herron</author_name>
      <isbn>1641291338</isbn>
      <user_rating>4</user_rating>
      <user_read_at><![CDATA[Thu, 6 Feb 2025 00:00:00 +0000]]></user_read_at>
      <user_date_added><![CDATA[Thu, 06 Feb 2025 17:56:54 -0800]]></user_date_added>
      <average_rating>4.25</average_rating>
      <book_published>2019</book_published>
      <book id="123"><num_pages>337</num_pages></book>
      <user_review/>
    </item>
  </channel>
</rss>
"""

PROFILE_HTML = """
<html><body>
  <a href="/review/list/152185079?shelf=read">Read</a>
  <a href="/review/list/152185079?shelf=currently-reading">Currently Reading</a>
  <a href="/review/list/152185079?shelf=to-read">Want to Read</a>
  <a href="/review/list/152185079?shelf=paused">Paused</a>
  <a href="/review/list/152185079?shelf=did-not-finish">DNF</a>
</body></html>
"""


class GoodreadsParseTests(TestCase):
    def test_parse_user_show_url(self):
        self.assertEqual(
            parse_goodreads_user_id("https://www.goodreads.com/user/show/152185079-sadman"),
            "152185079",
        )

    def test_parse_bare_id(self):
        self.assertEqual(parse_goodreads_user_id("152185079"), "152185079")

    def test_parse_list_rss_url(self):
        self.assertEqual(
            parse_goodreads_user_id(
                "https://www.goodreads.com/review/list_rss/999888777?shelf=read",
            ),
            "999888777",
        )

    def test_rejects_non_goodreads_host(self):
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            parse_goodreads_user_id("https://example.com/user/show/1")

    def test_parse_shelf_rss(self):
        books = parse_shelf_rss(SAMPLE_RSS)
        self.assertEqual(len(books), 1)
        self.assertEqual(books[0]["title"], "Joe Country")
        self.assertEqual(books[0]["author_name"], "Mick Herron")
        self.assertEqual(books[0]["user_rating"], 4)
        self.assertEqual(books[0]["num_pages"], "337")

    @mock.patch("books.goodreads._fetch_text")
    def test_discover_shelves_orders_standard_first(self, fetch_mock):
        fetch_mock.return_value = (PROFILE_HTML, "https://www.goodreads.com/user/show/152185079")
        slugs = discover_shelf_slugs("152185079")
        self.assertEqual(slugs[:3], ["currently-reading", "read", "to-read"])
        self.assertIn("paused", slugs)
        self.assertIn("did-not-finish", slugs)


class BooksApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com",
            password="password123",
            account_status=User.AccountStatus.APPROVED,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @mock.patch("books.views.fetch_all_shelves")
    @mock.patch("books.views.parse_goodreads_user_id", return_value="152185079")
    def test_link_saves_profile_and_returns_shelves(self, _parse_mock, fetch_mock):
        fetch_mock.return_value = {
            "goodreads_user_id": "152185079",
            "profile_url": "https://www.goodreads.com/user/show/152185079",
            "shelves": [
                {
                    "slug": "read",
                    "label": "Read",
                    "book_count": 1,
                    "books": [{"title": "Joe Country", "author_name": "Mick Herron"}],
                },
            ],
        }
        resp = self.client.post(
            "/api/v1/books/link/",
            {"profile_url": "https://www.goodreads.com/user/show/152185079"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["linked"])
        self.assertEqual(resp.data["goodreads_user_id"], "152185079")
        self.assertEqual(len(resp.data["shelves"]), 1)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.goodreads_user_id, "152185079")
        self.assertEqual(resp.data["session"]["profile"]["goodreads_user_id"], "152185079")

    @mock.patch("books.views.fetch_all_shelves")
    def test_shelves_requires_link(self, fetch_mock):
        resp = self.client.get("/api/v1/books/shelves/")
        self.assertEqual(resp.status_code, 400)
        fetch_mock.assert_not_called()

    @mock.patch("books.views.fetch_all_shelves")
    def test_shelves_uses_saved_id(self, fetch_mock):
        profile = self.user.profile
        profile.goodreads_user_id = "152185079"
        profile.save(update_fields=["goodreads_user_id"])
        fetch_mock.return_value = {
            "goodreads_user_id": "152185079",
            "profile_url": "https://www.goodreads.com/user/show/152185079",
            "shelves": [],
        }
        resp = self.client.get("/api/v1/books/shelves/")
        self.assertEqual(resp.status_code, 200)
        fetch_mock.assert_called_once()
        self.assertTrue(resp.data["linked"])

    def test_unlink_clears_profile(self):
        profile = self.user.profile
        profile.goodreads_user_id = "152185079"
        profile.save(update_fields=["goodreads_user_id"])
        resp = self.client.delete("/api/v1/books/unlink/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["linked"])
        profile.refresh_from_db()
        self.assertEqual(profile.goodreads_user_id, "")
