from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from calendars.models import CalendarSource, Event
from calendars.services import (
    IcalFetchError,
    parse_ics,
    sync_ical_source,
)
from calendars.tests.helpers import CalendarTestMixin


SAMPLE_ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-one@example.com
SUMMARY:Beach trip
LOCATION:Oceanside
DESCRIPTION:Bring sunscreen\\, and a towel.
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
DTEND:20260604T200000Z
END:VEVENT
END:VCALENDAR
"""


class ParseIcsTests(TestCase):
    def test_parses_timed_and_all_day_events(self):
        parsed = parse_ics(SAMPLE_ICS)
        self.assertEqual(len(parsed), 2)
        timed, all_day = parsed
        self.assertEqual(timed.uid, "event-one@example.com")
        self.assertEqual(timed.title, "Beach trip")
        self.assertEqual(timed.location, "Oceanside")
        self.assertEqual(timed.notes, "Bring sunscreen, and a towel.")
        self.assertFalse(timed.all_day)
        self.assertEqual(
            timed.start_at,
            datetime(2026, 6, 1, 13, 0, tzinfo=dt_timezone.utc),
        )
        self.assertEqual(
            timed.end_at,
            datetime(2026, 6, 4, 20, 0, tzinfo=dt_timezone.utc),
        )

        self.assertEqual(all_day.uid, "event-two@example.com")
        self.assertTrue(all_day.all_day)
        self.assertEqual(
            all_day.start_at,
            datetime(2026, 7, 1, 0, 0, tzinfo=dt_timezone.utc),
        )
        self.assertEqual(
            all_day.end_at,
            datetime(2026, 7, 2, 0, 0, tzinfo=dt_timezone.utc),
        )

    def test_unfolds_continuation_lines(self):
        # RFC 5545 folding: inserting CRLF + a single whitespace character is removed
        # on unfold, so exactly one (leading) whitespace disappears with the newline.
        ics = (
            "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\n"
            "SUMMARY:Long\r\n wrapped title\r\n"
            "DTSTART:20260101T000000Z\r\nDTEND:20260101T010000Z\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        parsed = parse_ics(ics)
        self.assertEqual(parsed[0].title, "Longwrapped title")


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

    def test_initial_sync_creates_events(self):
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
        self.assertEqual(
            set(Event.objects.filter(source=self.source).values_list("external_uid", flat=True)),
            {"event-one@example.com", "event-two@example.com"},
        )

    def test_not_modified_preserves_events(self):
        with patch(
            "calendars.services._fetch_ical",
            side_effect=self._mock_fetch(body=SAMPLE_ICS),
        ):
            sync_ical_source(self.source)
        self.assertEqual(Event.objects.filter(source=self.source).count(), 2)

        # Subsequent fetch returns 304 Not Modified.
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
        self.assertEqual(result.updated, 1)
        self.assertEqual(result.deleted, 1)
        self.assertEqual(
            Event.objects.filter(source=self.source).values_list("external_uid", "title")[0],
            ("event-one@example.com", "Beach trip (updated)"),
        )

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
