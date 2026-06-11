from django.test import TestCase

from slack_integration.quote_from_text import parse_slack_quote_command_text


class ParseSlackQuoteCommandTextTests(TestCase):
    def test_splits_body_and_attribution(self):
        body, attribution = parse_slack_quote_command_text("here's my quote -billy")
        self.assertEqual(body, "here's my quote")
        self.assertEqual(attribution, "billy")

    def test_attribution_with_space_after_dash(self):
        body, attribution = parse_slack_quote_command_text("here's my quote - billy")
        self.assertEqual(body, "here's my quote")
        self.assertEqual(attribution, "billy")

    def test_no_attribution_returns_full_text(self):
        body, attribution = parse_slack_quote_command_text("just a quote")
        self.assertEqual(body, "just a quote")
        self.assertIsNone(attribution)

    def test_empty_text(self):
        body, attribution = parse_slack_quote_command_text("   ")
        self.assertEqual(body, "")
        self.assertIsNone(attribution)

    def test_multiword_attribution(self):
        body, attribution = parse_slack_quote_command_text("Wisdom wins - Mary Oliver")
        self.assertEqual(body, "Wisdom wins")
        self.assertEqual(attribution, "Mary Oliver")
