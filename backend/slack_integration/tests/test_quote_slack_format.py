from django.contrib.auth import get_user_model
from django.test import TestCase

from quotes.models import Quote, QuoteLabel
from slack_integration.quote_slack_format import format_random_quote_slack_message

User = get_user_model()


class FormatRandomQuoteSlackMessageTests(TestCase):
    def test_includes_body_attribution_and_collector(self):
        owner = User.objects.create_user(email="alice@example.com", password="secret12345")
        owner.username = "alice"
        owner.save(update_fields=["username"])
        quote = Quote.objects.create(
            owner=owner,
            body="Hello world",
            visibility=Quote.Visibility.PUBLISHED,
        )
        label = QuoteLabel.objects.create(
            owner=owner,
            kind=QuoteLabel.Kind.ATTRIBUTION,
            name="billy",
        )
        quote.labels.add(label)

        text = format_random_quote_slack_message(quote)
        self.assertIn("Hello world", text)
        self.assertIn("billy", text)
        self.assertIn("alice", text)
        self.assertIn("Random quote", text)
