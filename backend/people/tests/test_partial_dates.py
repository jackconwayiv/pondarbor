from rest_framework.exceptions import ValidationError
from django.test import SimpleTestCase

from people.partial_dates import normalize_partial_date


class PartialDatesTests(SimpleTestCase):
    def test_full_date(self):
        self.assertEqual(normalize_partial_date("2000-05-15"), "2000-05-15")

    def test_month_day_without_year(self):
        self.assertEqual(normalize_partial_date("5-3"), "05-03")
        self.assertEqual(normalize_partial_date("12-31"), "12-31")

    def test_rejects_invalid(self):
        with self.assertRaises(ValidationError):
            normalize_partial_date("2000-02-30")
        with self.assertRaises(ValidationError):
            normalize_partial_date("13-01")
