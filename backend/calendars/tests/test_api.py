from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from calendars.models import CalendarSource, Event
from calendars.services import SyncResult
from calendars.tests.helpers import CalendarTestMixin


class EventsApiTests(CalendarTestMixin, TestCase):
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
        self.alice_event = Event.objects.create(
            owner=self.alice,
            source=self.alice_source,
            title="Alice trip",
            start_at=datetime(2026, 5, 1, 9, 0, tzinfo=dt_timezone.utc),
            end_at=datetime(2026, 5, 5, 9, 0, tzinfo=dt_timezone.utc),
        )
        self.bob_event = Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            title="Bob trip",
            start_at=datetime(2026, 5, 2, 9, 0, tzinfo=dt_timezone.utc),
            end_at=datetime(2026, 5, 3, 9, 0, tzinfo=dt_timezone.utc),
        )

    def test_anonymous_cannot_list_events(self):
        resp = self.anon_client.get(
            "/api/v1/calendars/events/?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z"
        )
        self.assertEqual(resp.status_code, 403)

    def test_pending_user_cannot_list_events(self):
        resp = self.pending_client.get(
            "/api/v1/calendars/events/?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z"
        )
        self.assertEqual(resp.status_code, 403)

    def test_approved_user_sees_all_approved_events_by_default(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z"
        )
        self.assertEqual(resp.status_code, 200)
        titles = sorted(row["title"] for row in resp.json()["results"])
        self.assertEqual(titles, ["Alice trip", "Bob trip"])

    def test_owner_filter_me(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z&owner=me"
        )
        titles = [row["title"] for row in resp.json()["results"]]
        self.assertEqual(titles, ["Alice trip"])

    def test_owner_filter_specific_user(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            f"?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z&owner={self.bob.id}"
        )
        titles = [row["title"] for row in resp.json()["results"]]
        self.assertEqual(titles, ["Bob trip"])

    def test_owner_filter_unknown_user(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start=2026-05-01T00:00:00Z&end=2026-06-01T00:00:00Z&owner=99999"
        )
        self.assertEqual(resp.status_code, 404)

    def test_missing_params_is_400(self):
        resp = self.alice_client.get("/api/v1/calendars/events/")
        self.assertEqual(resp.status_code, 400)

    def test_create_manual_event(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/events/",
            {
                "title": "New meeting",
                "start_at": "2026-06-10T09:00:00Z",
                "end_at": "2026-06-10T10:00:00Z",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["title"], "New meeting")
        self.assertTrue(resp.json()["is_manual"])

    def test_create_event_rejects_end_before_start(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/events/",
            {
                "title": "Bad",
                "start_at": "2026-06-10T10:00:00Z",
                "end_at": "2026-06-10T09:00:00Z",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_and_delete_manual_event(self):
        resp = self.alice_client.patch(
            f"/api/v1/calendars/events/{self.alice_event.id}/",
            {
                "title": "Alice renamed",
                "start_at": "2026-05-01T09:00:00Z",
                "end_at": "2026-05-02T09:00:00Z",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["title"], "Alice renamed")

        resp = self.alice_client.delete(f"/api/v1/calendars/events/{self.alice_event.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Event.objects.filter(pk=self.alice_event.id).exists())

    def test_cannot_edit_other_users_event(self):
        resp = self.alice_client.delete(f"/api/v1/calendars/events/{self.bob_event.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_cannot_edit_imported_event(self):
        ical_source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Imported",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        imported = Event.objects.create(
            owner=self.alice,
            source=ical_source,
            external_uid="uid-1",
            title="Imported",
            start_at=datetime(2026, 5, 10, 9, 0, tzinfo=dt_timezone.utc),
            end_at=datetime(2026, 5, 10, 10, 0, tzinfo=dt_timezone.utc),
        )
        resp = self.alice_client.delete(f"/api/v1/calendars/events/{imported.id}/")
        self.assertEqual(resp.status_code, 400)
        resp = self.alice_client.patch(
            f"/api/v1/calendars/events/{imported.id}/",
            {
                "title": "nope",
                "start_at": "2026-05-10T09:00:00Z",
                "end_at": "2026-05-10T10:00:00Z",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class SourcesApiTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()

    def test_anonymous_cannot_list_sources(self):
        resp = self.anon_client.get("/api/v1/calendars/sources/")
        self.assertEqual(resp.status_code, 403)

    def test_post_requires_https_google_host(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/sources/",
            {
                "display_name": "Bad",
                "ical_url": "https://evil.example.com/cal.ics",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

        resp = self.alice_client.post(
            "/api/v1/calendars/sources/",
            {
                "display_name": "Bad",
                "ical_url": "http://calendar.google.com/cal.ics",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_post_creates_and_runs_initial_sync(self):
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=True, created=3),
        ) as mock_sync:
            resp = self.alice_client.post(
                "/api/v1/calendars/sources/",
                {
                    "display_name": "Trips",
                    "ical_url": "https://calendar.google.com/calendar/ical/x/basic.ics",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.content)
        mock_sync.assert_called_once()
        self.assertEqual(
            CalendarSource.objects.filter(
                owner=self.alice, source_type=CalendarSource.SourceType.ICAL
            ).count(),
            1,
        )

    def test_post_rolls_back_on_sync_failure(self):
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=False, error="404 Not Found"),
        ):
            resp = self.alice_client.post(
                "/api/v1/calendars/sources/",
                {
                    "display_name": "Trips",
                    "ical_url": "https://calendar.google.com/calendar/ical/x/basic.ics",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(
            CalendarSource.objects.filter(owner=self.alice, ical_url__startswith="https").exists()
        )

    def test_post_rejects_duplicate(self):
        CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        resp = self.alice_client.post(
            "/api/v1/calendars/sources/",
            {
                "display_name": "Trips 2",
                "ical_url": "https://calendar.google.com/calendar/ical/x/basic.ics",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_delete_ical_source(self):
        source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        resp = self.alice_client.delete(f"/api/v1/calendars/sources/{source.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(CalendarSource.objects.filter(pk=source.id).exists())

    def test_cannot_delete_someone_elses_source(self):
        source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        resp = self.bob_client.delete(f"/api/v1/calendars/sources/{source.id}/")
        self.assertEqual(resp.status_code, 404)


class ApprovedUsersEndpointTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()

    def test_returns_approved_users_only(self):
        resp = self.alice_client.get("/api/v1/calendars/approved-users/")
        self.assertEqual(resp.status_code, 200)
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertIn("alice@example.com", emails)
        self.assertIn("bob@example.com", emails)
        self.assertNotIn("pending@example.com", emails)

    def test_query_param_search(self):
        resp = self.alice_client.get("/api/v1/calendars/approved-users/?q=bob")
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertEqual(emails, {"bob@example.com"})
