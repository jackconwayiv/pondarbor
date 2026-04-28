from datetime import datetime, timezone as dt_timezone

from django.test import SimpleTestCase

from .phoenix_calendar import phoenix_campaign_calendar_date


class PhoenixCalendarTests(SimpleTestCase):
    def test_before_3am_counts_as_previous_calendar_date(self):
        # Jan 2 2025 02:59 America/Phoenix → still "Jan 1" campaign date
        utc = datetime(2025, 1, 2, 9, 59, 0, tzinfo=dt_timezone.utc)  # 02:59 Phoenix on Jan 2
        d = phoenix_campaign_calendar_date(utc)
        self.assertEqual(d.isoformat(), "2025-01-01")

    def test_at_or_after_3am_uses_current_date(self):
        utc = datetime(2025, 1, 2, 10, 0, 0, tzinfo=dt_timezone.utc)  # 03:00 Phoenix Jan 2
        d = phoenix_campaign_calendar_date(utc)
        self.assertEqual(d.isoformat(), "2025-01-02")
