from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from calendars.ical_export import build_subscription_ics
from calendars.models import CalendarSource, CalendarSubscription, Event
from calendars.tests.helpers import CalendarTestMixin
from friends.models import FriendRequest
from users.models import Profile


class CalendarFeedExportTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.alice_source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual events",
        )
        self.bob_source = CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual events",
        )

    def test_build_ics_merges_same_day_names(self):
        Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            title="Secret trip",
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            title="Bob trip",
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        body, _etag = build_subscription_ics(
            subscriber=self.alice,
            owner_ids=[self.alice.id, self.bob.id],
        )
        self.assertIn("X-WR-CALNAME:Friends Away", body)
        self.assertIn("SUMMARY:Alice\\, Bob", body)
        self.assertNotIn("Secret trip", body)
        self.assertNotIn("Bob trip", body)
        self.assertEqual(body.count("BEGIN:VEVENT"), 1)

    def test_build_ics_coalesces_consecutive_days_with_same_names(self):
        Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 12),
        )
        body, _etag = build_subscription_ics(
            subscriber=self.alice,
            owner_ids=[self.alice.id],
        )
        self.assertIn("DTSTART;VALUE=DATE:20260510", body)
        self.assertIn("DTEND;VALUE=DATE:20260513", body)
        self.assertEqual(body.count("BEGIN:VEVENT"), 1)

    def test_build_ics_splits_when_name_set_changes(self):
        Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 12),
        )
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 11),
            end_date=date(2026, 5, 11),
        )
        body, _etag = build_subscription_ics(
            subscriber=self.alice,
            owner_ids=[self.alice.id, self.bob.id],
        )
        self.assertEqual(body.count("BEGIN:VEVENT"), 3)
        self.assertIn("SUMMARY:Alice", body)
        self.assertIn("SUMMARY:Alice\\, Bob", body)


class CalendarFeedApiTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.alice_source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual events",
        )
        self.bob_source = CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual events",
        )

    def test_post_feed_requires_at_least_one_person(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/feed/",
            {"owner_ids": []},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_post_feed_creates_subscription_and_urls(self):
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.alice_client.post(
                "/api/v1/calendars/feed/",
                {"owner_ids": [self.alice.id, self.bob.id]},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("subscribe_url", body)
        self.assertIn("webcal_url", body)
        self.assertTrue(body["subscribe_url"].endswith(".ics"))
        self.assertTrue(body["webcal_url"].startswith("webcal://"))
        sub = CalendarSubscription.objects.get(owner=self.alice)
        self.assertEqual(sub.owner_ids, [self.alice.id, self.bob.id])

    def test_get_feed_404_when_missing(self):
        resp = self.alice_client.get("/api/v1/calendars/feed/")
        self.assertEqual(resp.status_code, 404)

    def test_ics_feed_invalid_token_404(self):
        resp = self.anon_client.get("/api/v1/calendars/feed/not-a-real-token.ics")
        self.assertEqual(resp.status_code, 404)

    def test_ics_feed_returns_calendar_and_supports_etag(self):
        Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        sub = CalendarSubscription.objects.create(
            owner=self.alice,
            token="feed-token-test",
            owner_ids=[self.alice.id],
        )
        resp = self.anon_client.get(f"/api/v1/calendars/feed/{sub.token}.ics")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/calendar; charset=utf-8")
        self.assertIn("BEGIN:VCALENDAR", resp.content.decode("utf-8"))
        etag = resp["ETag"]
        resp304 = self.anon_client.get(
            f"/api/v1/calendars/feed/{sub.token}.ics",
            HTTP_IF_NONE_MATCH=etag,
        )
        self.assertEqual(resp304.status_code, 304)

    def test_ics_feed_supports_head(self):
        Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        sub = CalendarSubscription.objects.create(
            owner=self.alice,
            token="feed-token-head",
            owner_ids=[self.alice.id],
        )
        resp = self.anon_client.head(f"/api/v1/calendars/feed/{sub.token}.ics")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/calendar; charset=utf-8")
        self.assertEqual(resp.content, b"")

    @override_settings(DEBUG=False)
    def test_subscribe_url_forced_https_in_production(self):
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.alice_client.post(
                "/api/v1/calendars/feed/",
                {"owner_ids": [self.alice.id, self.bob.id]},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["subscribe_url"].startswith("https://"))
        self.assertTrue(body["webcal_url"].startswith("webcal://"))

    @override_settings(DEBUG=True)
    def test_subscribe_url_allows_http_in_debug(self):
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.alice_client.post(
                "/api/v1/calendars/feed/",
                {"owner_ids": [self.alice.id, self.bob.id]},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["subscribe_url"].startswith("http://"))

    @patch("calendars.feed_views.sync_stale_sources_for_owner_ids")
    def test_ics_feed_syncs_on_poll(self, mock_sync):
        CalendarSubscription.objects.create(
            owner=self.alice,
            token="sync-on-poll",
            owner_ids=[self.alice.id],
        )
        self.anon_client.get("/api/v1/calendars/feed/sync-on-poll.ics")
        mock_sync.assert_called_once_with([self.alice.id])

    def test_friends_only_owner_excluded_for_non_friend_subscriber(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            title="Bob trip",
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        body, _ = build_subscription_ics(
            subscriber=self.alice,
            owner_ids=[self.bob.id],
        )
        self.assertNotIn("SUMMARY:Bob", body)

    def test_friends_only_owner_included_for_friend_subscriber(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])
        FriendRequest.objects.update_or_create(
            requester=self.alice, requested=self.bob, defaults={"is_accepted": True}
        )
        FriendRequest.objects.update_or_create(
            requester=self.bob, requested=self.alice, defaults={"is_accepted": True}
        )
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        body, _ = build_subscription_ics(
            subscriber=self.alice,
            owner_ids=[self.bob.id],
        )
        self.assertIn("SUMMARY:Bob", body)

    def test_post_feed_rejects_unavailable_owner_id(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/feed/",
            {"owner_ids": [self.bob.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_reset_feed_rotates_token(self):
        sub = CalendarSubscription.objects.create(
            owner=self.alice,
            token="old-token",
            owner_ids=[self.alice.id],
        )
        resp = self.alice_client.post("/api/v1/calendars/feed/reset/")
        self.assertEqual(resp.status_code, 200)
        sub.refresh_from_db()
        self.assertNotEqual(sub.token, "old-token")
        resp_old = self.anon_client.get("/api/v1/calendars/feed/old-token.ics")
        self.assertEqual(resp_old.status_code, 404)

    def test_stale_ical_source_synced_for_subscription_owners(self):
        source = CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Google",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
            last_synced_at=timezone.now() - timedelta(hours=2),
        )
        CalendarSubscription.objects.create(
            owner=self.alice,
            token="stale-sync",
            owner_ids=[self.bob.id],
        )
        with patch("calendars.feed_sync.sync_ical_source") as mock_sync:
            mock_sync.return_value.ok = True
            mock_sync.return_value.created = 1
            mock_sync.return_value.updated = 0
            mock_sync.return_value.deleted = 0
            self.anon_client.get("/api/v1/calendars/feed/stale-sync.ics")
        mock_sync.assert_called_once_with(source)

    def test_post_feed_rejects_friends_only_user_not_visible(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.alice_client.post(
                "/api/v1/calendars/feed/",
                {"include_all_visible": False, "owner_ids": [self.bob.id]},
                format="json",
            )
        self.assertEqual(resp.status_code, 400)

    def test_post_feed_include_all_visible(self):
        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.alice_client.post(
                "/api/v1/calendars/feed/",
                {"include_all_visible": True},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["include_all_visible"])
        self.assertEqual(body["owner_ids"], [])
        sub = CalendarSubscription.objects.get(owner=self.alice)
        self.assertTrue(sub.include_all_visible)

    def test_include_all_visible_feed_adds_newly_visible_user_on_poll(self):
        from calendars.feed_views import resolve_subscription_owner_ids

        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        sub = CalendarSubscription.objects.create(
            owner=self.alice,
            token="all-visible",
            owner_ids=[],
            include_all_visible=True,
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            ids_before = resolve_subscription_owner_ids(sub)
        self.assertIn(self.alice.id, ids_before)
        self.assertIn(self.bob.id, ids_before)

        Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 1),
        )
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            resp = self.anon_client.get("/api/v1/calendars/feed/all-visible.ics")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("SUMMARY:Bob", resp.content.decode("utf-8"))
