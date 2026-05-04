from datetime import date, timedelta
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
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 5),
        )
        self.bob_event = Event.objects.create(
            owner=self.bob,
            source=self.bob_source,
            title="Bob trip",
            start_date=date(2026, 5, 2),
            end_date=date(2026, 5, 3),
        )
        self.alice.profile.birth_date = date(1990, 5, 17)
        self.alice.profile.save(update_fields=["birth_date"])
        self.bob.profile.birth_date = date(1991, 5, 2)
        self.bob.profile.save(update_fields=["birth_date"])

    def test_anonymous_cannot_list_events(self):
        resp = self.anon_client.get(
            "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01"
        )
        self.assertEqual(resp.status_code, 403)

    def test_pending_user_cannot_list_events(self):
        resp = self.pending_client.get(
            "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01"
        )
        self.assertEqual(resp.status_code, 403)

    def test_approved_user_sees_all_approved_events_by_default(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01"
        )
        self.assertEqual(resp.status_code, 200)
        owners = sorted(row["owner"]["display_name"] for row in resp.json()["results"])
        self.assertEqual(owners, ["Alice", "Bob"])

    def test_bootstrap_matches_individual_endpoints(self):
        q = "start_date=2026-05-01&end_date=2026-06-01&owner=all"
        ev = self.alice_client.get(f"/api/v1/calendars/events/?{q}").json()
        src = self.alice_client.get("/api/v1/calendars/sources/").json()
        appr = self.alice_client.get("/api/v1/calendars/approved-users/").json()
        boot = self.alice_client.get(f"/api/v1/calendars/bootstrap/?{q}").json()
        self.assertEqual(boot["events"], ev["results"])
        self.assertEqual(boot["sources"], src["results"])
        self.assertEqual(boot["approved_users"], appr["results"])

    def test_bootstrap_includes_birthdays(self):
        q = "start_date=2026-05-01&end_date=2026-06-01&owner=all"
        with patch("calendars.views.timezone.localdate", return_value=date(2026, 5, 1)):
            boot = self.alice_client.get(f"/api/v1/calendars/bootstrap/?{q}")
        self.assertEqual(boot.status_code, 200)
        body = boot.json()
        birthday_rows = body.get("birthdays", [])
        self.assertEqual(len(birthday_rows), 2)
        self.assertIn("sync_pending_sources", body)
        self.assertIsInstance(body["sync_pending_sources"], int)
        self.assertIn(
            {
                "user_id": self.alice.id,
                "display_name": "Alice",
                "birth_month": 5,
                "birth_day": 17,
            },
            birthday_rows,
        )

    def test_sync_refresh_returns_events_birthdays_and_summary(self):
        CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Alice iCal",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
            is_active=True,
            last_synced_at=timezone.now() - timedelta(hours=2),
        )
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=True, created=2, updated=1, deleted=0),
        ) as mock_sync:
            resp = self.alice_client.post(
                "/api/v1/calendars/sync-refresh/"
                "?start_date=2026-05-01&end_date=2026-06-01&owner=all"
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("events", body)
        self.assertIn("birthdays", body)
        self.assertIn("synced", body)
        self.assertEqual(body["synced"]["sources_processed"], 1)
        self.assertEqual(body["synced"]["created"], 2)
        self.assertEqual(body["synced"]["updated"], 1)
        mock_sync.assert_called_once()

    def test_events_list_does_not_trigger_inline_ical_sync(self):
        with patch("calendars.views.sync_ical_source") as mock_sync:
            resp = self.alice_client.get(
                "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01"
            )
        self.assertEqual(resp.status_code, 200)
        mock_sync.assert_not_called()

    def test_bootstrap_does_not_trigger_inline_ical_sync(self):
        with patch("calendars.views.sync_ical_source") as mock_sync:
            resp = self.alice_client.get(
                "/api/v1/calendars/bootstrap/"
                "?start_date=2026-05-01&end_date=2026-06-01&owner=all"
            )
        self.assertEqual(resp.status_code, 200)
        mock_sync.assert_not_called()

    def test_owner_filter_me(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start_date=2026-05-01&end_date=2026-06-01&owner=me"
        )
        names = [row["owner"]["display_name"] for row in resp.json()["results"]]
        self.assertEqual(names, ["Alice"])

    def test_owner_filter_specific_user(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            f"?start_date=2026-05-01&end_date=2026-06-01&owner={self.bob.id}"
        )
        names = [row["owner"]["display_name"] for row in resp.json()["results"]]
        self.assertEqual(names, ["Bob"])

    def test_owner_filter_unknown_user(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start_date=2026-05-01&end_date=2026-06-01&owner=99999"
        )
        self.assertEqual(resp.status_code, 404)

    def test_owner_ids_param_filters_to_subset(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            f"?start_date=2026-05-01&end_date=2026-06-01&owner_ids={self.bob.id}"
        )
        self.assertEqual(resp.status_code, 200)
        names = [row["owner"]["display_name"] for row in resp.json()["results"]]
        self.assertEqual(names, ["Bob"])

    def test_owner_ids_empty_returns_no_events(self):
        # An "uncheck all" client passes owner_ids=999 (a user that exists but
        # isn't approved) — we should return nothing rather than fall back.
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start_date=2026-05-01&end_date=2026-06-01&owner_ids=99999"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["results"], [])

    def test_owner_ids_non_integer_is_400(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/"
            "?start_date=2026-05-01&end_date=2026-06-01&owner_ids=abc"
        )
        self.assertEqual(resp.status_code, 400)

    def test_missing_params_is_400(self):
        resp = self.alice_client.get("/api/v1/calendars/events/")
        self.assertEqual(resp.status_code, 400)

    def test_create_manual_event(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/events/",
            {
                "title": "New meeting",
                "start_date": "2026-06-10",
                "end_date": "2026-06-10",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        body = resp.json()
        self.assertEqual(body["title"], "New meeting")
        self.assertTrue(body["is_manual"])
        self.assertEqual(body["start_date"], "2026-06-10")
        self.assertEqual(body["end_date"], "2026-06-10")

    def test_create_event_allows_blank_title(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/events/",
            {"start_date": "2026-06-10", "end_date": "2026-06-12"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.json()["title"], "")

    def test_create_event_rejects_end_before_start(self):
        resp = self.alice_client.post(
            "/api/v1/calendars/events/",
            {
                "title": "Bad",
                "start_date": "2026-06-10",
                "end_date": "2026-06-09",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_and_delete_manual_event(self):
        resp = self.alice_client.patch(
            f"/api/v1/calendars/events/{self.alice_event.id}/",
            {
                "title": "Alice renamed",
                "start_date": "2026-05-01",
                "end_date": "2026-05-02",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertEqual(body["title"], "Alice renamed")
        self.assertEqual(body["end_date"], "2026-05-02")

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
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        resp = self.alice_client.delete(f"/api/v1/calendars/events/{imported.id}/")
        self.assertEqual(resp.status_code, 400)
        resp = self.alice_client.patch(
            f"/api/v1/calendars/events/{imported.id}/",
            {
                "title": "nope",
                "start_date": "2026-05-10",
                "end_date": "2026-05-10",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class EventPrivacyTests(CalendarTestMixin, TestCase):
    """No shared-calendar text ever leaks to the API or the database."""

    def setUp(self):
        self.create_users()
        self.ical_source = CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Bob's import",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        # Even if some buggy code path put text in here, the model layer must
        # strip it back to "" when the source is non-manual.
        self.imported = Event.objects.create(
            owner=self.bob,
            source=self.ical_source,
            external_uid="event-imported",
            title="Top-secret meeting",
            start_date=date(2026, 5, 10),
            end_date=date(2026, 5, 10),
        )
        self.imported.refresh_from_db()

    def test_model_strips_title_for_non_manual_source(self):
        self.assertEqual(self.imported.title, "")

    def test_event_response_only_contains_dates_and_owner(self):
        resp = self.alice_client.get(
            "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01"
        )
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()["results"]
        imported_row = next(r for r in rows if r["owner"]["id"] == self.bob.id)
        # Whitelist the keys the API may return for an event.
        self.assertEqual(
            set(imported_row.keys()),
            {"id", "owner", "source_type", "is_manual", "title", "start_date", "end_date"},
        )
        # Critically: title is null for shared/iCal events.
        self.assertIsNone(imported_row["title"])
        self.assertEqual(imported_row["source_type"], "ical")
        self.assertFalse(imported_row["is_manual"])
        self.assertEqual(imported_row["start_date"], "2026-05-10")
        self.assertEqual(imported_row["end_date"], "2026-05-10")

    def test_manual_title_is_visible_only_to_owner(self):
        manual_source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual events",
        )
        Event.objects.create(
            owner=self.alice,
            source=manual_source,
            title="Alice's private label",
            start_date=date(2026, 5, 12),
            end_date=date(2026, 5, 12),
        )
        # Owner sees their own title.
        resp = self.alice_client.get(
            "/api/v1/calendars/events/?start_date=2026-05-01&end_date=2026-06-01&owner=me"
        )
        rows = resp.json()["results"]
        self.assertEqual(rows[0]["title"], "Alice's private label")

        # Bob, looking at Alice's events, cannot see her title text.
        resp = self.bob_client.get(
            "/api/v1/calendars/events/"
            f"?start_date=2026-05-01&end_date=2026-06-01&owner={self.alice.id}"
        )
        rows = resp.json()["results"]
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["title"])


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

    def test_source_response_excludes_ical_url_and_feed_metadata(self):
        CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/secret/basic.ics",
            last_etag='W/"abc"',
            last_modified_header="Sun, 20 Apr 2026 10:00:00 GMT",
        )
        resp = self.alice_client.get("/api/v1/calendars/sources/")
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()["results"]
        self.assertGreater(len(rows), 0)
        for row in rows:
            self.assertNotIn("ical_url", row)
            self.assertNotIn("last_etag", row)
            self.assertNotIn("last_modified_header", row)


class ApprovedUsersEndpointTests(CalendarTestMixin, TestCase):
    """Visibility uses `timezone.localdate()` — patch for stable assertions."""

    anchor = date(2026, 4, 22)

    def setUp(self):
        self.create_users()
        alice_manual = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual",
        )
        bob_manual = CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual",
        )
        Event.objects.create(
            owner=self.alice,
            source=alice_manual,
            title="",
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 2),
        )
        Event.objects.create(
            owner=self.bob,
            source=bob_manual,
            title="",
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 2),
        )

    def test_returns_approved_users_only(self):
        with patch("calendars.views.timezone.localdate", return_value=self.anchor):
            resp = self.alice_client.get("/api/v1/calendars/approved-users/")
        self.assertEqual(resp.status_code, 200)
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertIn("alice@example.com", emails)
        self.assertIn("bob@example.com", emails)
        self.assertNotIn("pending@example.com", emails)

    def test_query_param_search(self):
        with patch("calendars.views.timezone.localdate", return_value=self.anchor):
            resp = self.alice_client.get("/api/v1/calendars/approved-users/?q=bob")
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertEqual(emails, {"bob@example.com"})

    def test_excludes_other_with_only_past_events_and_no_linked_calendar(self):
        june = date(2026, 6, 15)
        with patch("calendars.views.timezone.localdate", return_value=june):
            resp = self.alice_client.get("/api/v1/calendars/approved-users/")
        self.assertEqual(resp.status_code, 200)
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertEqual(emails, {"alice@example.com"})

    def test_includes_other_with_linked_calendar_even_if_no_upcoming_events(self):
        june = date(2026, 6, 15)
        CalendarSource.objects.create(
            owner=self.bob,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )
        with patch("calendars.views.timezone.localdate", return_value=june):
            resp = self.alice_client.get("/api/v1/calendars/approved-users/")
        emails = {row["email"] for row in resp.json()["results"]}
        self.assertEqual(emails, {"alice@example.com", "bob@example.com"})

    def test_search_does_not_surface_hidden_users(self):
        june = date(2026, 6, 15)
        with patch("calendars.views.timezone.localdate", return_value=june):
            resp = self.alice_client.get("/api/v1/calendars/approved-users/?q=bob")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["results"], [])
