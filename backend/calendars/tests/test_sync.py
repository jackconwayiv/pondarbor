from datetime import date
from unittest.mock import patch

from django.test import TestCase

from calendars.models import CalendarSource, Event
from calendars.services import (
    IcalFetchError,
    parse_ics,
    sync_ical_source,
)
from calendars.tests.helpers import CalendarTestMixin


# A feed deliberately stuffed with text properties — none of which we should
# ever read or persist. Only DTSTART/DTEND/UID matter.
SAMPLE_ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-one@example.com
SUMMARY:Beach trip
LOCATION:Oceanside
DESCRIPTION:Bring sunscreen\\, and a towel.
ORGANIZER:mailto:alice@example.com
ATTENDEE:mailto:bob@example.com
URL:https://example.com/trip
CATEGORIES:Vacation,Family
DTSTART:20260601T130000Z
DTEND:20260604T200000Z
END:VEVENT
BEGIN:VEVENT
UID:event-two@example.com
SUMMARY:Day trip
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260702
END:VEVENT
END:VCALENDAR
"""

SAMPLE_ICS_AFTER_DELETE = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-one@example.com
SUMMARY:Beach trip (updated)
DTSTART:20260601T130000Z
DTEND:20260605T200000Z
END:VEVENT
END:VCALENDAR
"""


class ParseIcsTests(TestCase):
    def test_parses_dates_and_ignores_all_text_properties(self):
        parsed = parse_ics(SAMPLE_ICS)
        self.assertEqual(len(parsed), 2)
        timed, all_day = parsed
        self.assertEqual(timed.uid, "event-one@example.com")
        self.assertEqual(timed.start_date, date(2026, 6, 1))
        self.assertEqual(timed.end_date, date(2026, 6, 4))
        # ParsedEvent has no title/location/notes fields at all.
        self.assertFalse(hasattr(timed, "title"))
        self.assertFalse(hasattr(timed, "location"))
        self.assertFalse(hasattr(timed, "notes"))

        self.assertEqual(all_day.uid, "event-two@example.com")
        # All-day DTEND in ICS is exclusive; we store inclusive.
        self.assertEqual(all_day.start_date, date(2026, 7, 1))
        self.assertEqual(all_day.end_date, date(2026, 7, 1))

    def test_unfolds_continuation_lines(self):
        # Folded SUMMARY is no-op now because we ignore SUMMARY entirely; this
        # test just verifies the folding doesn't break date parsing.
        ics = (
            "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\n"
            "SUMMARY:Long\r\n wrapped title\r\n"
            "DTSTART:20260101T000000Z\r\nDTEND:20260101T010000Z\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        parsed = parse_ics(ics)
        self.assertEqual(parsed[0].uid, "x")
        self.assertEqual(parsed[0].start_date, date(2026, 1, 1))

    def test_tzid_evening_uses_local_calendar_day_not_utc(self):
        """Monday 6pm Chicago must not become Tuesday when stored as busy dates."""
        ics = (
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
            "UID:mon-evening@example.com\r\n"
            "DTSTART;TZID=America/Chicago:20250113T180000\r\n"
            "DTEND;TZID=America/Chicago:20250113T190000\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        parsed = parse_ics(ics)
        self.assertEqual(len(parsed), 1)
        ev = parsed[0]
        self.assertEqual(ev.start_date, date(2025, 1, 13))
        self.assertEqual(ev.end_date, date(2025, 1, 13))

    def test_utc_z_uses_fallback_timezone_for_civil_day(self):
        ics = (
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
            "UID:z-evening@example.com\r\n"
            "DTSTART:20250114T000000Z\r\n"
            "DTEND:20250114T010000Z\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        parsed = parse_ics(ics, fallback_tzid="America/Chicago")
        self.assertEqual(len(parsed), 1)
        ev = parsed[0]
        self.assertEqual(ev.start_date, date(2025, 1, 13))
        self.assertEqual(ev.end_date, date(2025, 1, 13))

    def test_calendar_timezone_takes_precedence_over_fallback(self):
        # 06:30Z is Jan 14 in Chicago but Jan 13 in Phoenix.
        ics = (
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"
            "X-WR-TIMEZONE:America/Chicago\r\n"
            "BEGIN:VEVENT\r\n"
            "UID:calendar-tz-priority@example.com\r\n"
            "DTSTART:20250114T063000Z\r\n"
            "DTEND:20250114T073000Z\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        parsed = parse_ics(ics, fallback_tzid="America/Phoenix")
        self.assertEqual(len(parsed), 1)
        ev = parsed[0]
        self.assertEqual(ev.start_date, date(2025, 1, 14))
        self.assertEqual(ev.end_date, date(2025, 1, 14))


class SyncIcalSourceTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        self.source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/x/basic.ics",
        )

    def _mock_fetch(self, *, body, etag="", last_modified="", status=200):
        resp_etag = etag
        resp_last_modified = last_modified
        resp_status = status
        resp_body = body

        def fake_fetch(url, *, etag, last_modified):
            return (
                resp_status,
                resp_body,
                {"ETag": resp_etag, "Last-Modified": resp_last_modified},
            )

        return fake_fetch

    def test_initial_sync_creates_events_with_no_text(self):
        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=SAMPLE_ICS, etag='W/"abc"', last_modified="Sun"),
        ):
            result = sync_ical_source(self.source)
        self.assertTrue(result.ok)
        self.assertEqual(result.created, 2)
        self.assertEqual(result.updated, 0)
        self.assertEqual(result.deleted, 0)
        self.source.refresh_from_db()
        self.assertEqual(self.source.last_etag, 'W/"abc"')
        self.assertEqual(self.source.last_modified_header, "Sun")
        self.assertIsNotNone(self.source.last_synced_at)
        events = list(Event.objects.filter(source=self.source).order_by("external_uid"))
        self.assertEqual(
            {ev.external_uid for ev in events},
            {"event-one@example.com", "event-two@example.com"},
        )
        # Crucially: zero shared-feed text persisted.
        for ev in events:
            self.assertEqual(ev.title, "")

    def test_not_modified_preserves_events(self):
        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=SAMPLE_ICS),
        ):
            sync_ical_source(self.source)
        self.assertEqual(Event.objects.filter(source=self.source).count(), 2)

        def fake_fetch(url, *, etag, last_modified):
            return 304, "", {}

        with patch("calendars.services._fetch_ical", side_effect=fake_fetch):
            result = sync_ical_source(self.source)
        self.assertTrue(result.ok)
        self.assertTrue(result.not_modified)
        self.assertEqual(Event.objects.filter(source=self.source).count(), 2)

    def test_update_and_delete(self):
        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=SAMPLE_ICS),
        ):
            sync_ical_source(self.source)

        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=SAMPLE_ICS_AFTER_DELETE),
        ):
            result = sync_ical_source(self.source)

        self.assertTrue(result.ok)
        # event-one's end_date changed (4th -> 5th); event-two went away.
        self.assertEqual(result.updated, 1)
        self.assertEqual(result.deleted, 1)
        survivor = Event.objects.get(source=self.source)
        self.assertEqual(survivor.external_uid, "event-one@example.com")
        self.assertEqual(survivor.title, "")
        self.assertEqual(survivor.start_date, date(2026, 6, 1))
        self.assertEqual(survivor.end_date, date(2026, 6, 5))

    def test_fetch_failure_records_error(self):
        def fake_fetch(url, *, etag, last_modified):
            raise IcalFetchError("boom")

        with patch("calendars.services._fetch_ical", side_effect=fake_fetch):
            result = sync_ical_source(self.source)
        self.assertFalse(result.ok)
        self.source.refresh_from_db()
        self.assertIn("boom", self.source.last_error)

    def test_sync_rejects_manual_source(self):
        manual = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual",
        )
        result = sync_ical_source(manual)
        self.assertFalse(result.ok)

    def test_sync_uses_owner_profile_timezone_fallback_for_z_times(self):
        self.alice.profile.timezone = "America/Chicago"
        self.alice.profile.save(update_fields=["timezone"])
        ics = (
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
            "UID:owner-tz-fallback@example.com\r\n"
            "DTSTART:20250114T000000Z\r\n"
            "DTEND:20250114T010000Z\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=ics),
        ):
            result = sync_ical_source(self.source)
        self.assertTrue(result.ok)
        ev = Event.objects.get(source=self.source, external_uid="owner-tz-fallback@example.com")
        self.assertEqual(ev.start_date, date(2025, 1, 13))
        self.assertEqual(ev.end_date, date(2025, 1, 13))
