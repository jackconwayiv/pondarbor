from django.contrib.auth import get_user_model
from django.test import TestCase

from quotes.discoverable import discoverable_published_quotes_qs, random_discoverable_published_quote
from quotes.models import Quote, QuoteLabel
from users.models import Profile

User = get_user_model()


class DiscoverablePublishedQuotesTests(TestCase):
    def setUp(self):
        self.public_owner = User.objects.create_user(email="public@example.com", password="secret12345")
        self.public_owner.account_status = User.AccountStatus.APPROVED
        self.public_owner.username = "public_user"
        self.public_owner.save(update_fields=["account_status", "username"])

        self.private_owner = User.objects.create_user(email="private@example.com", password="secret12345")
        self.private_owner.account_status = User.AccountStatus.APPROVED
        self.private_owner.save(update_fields=["account_status"])

        self.friends_owner = User.objects.create_user(email="friends@example.com", password="secret12345")
        self.friends_owner.account_status = User.AccountStatus.APPROVED
        self.friends_owner.save(update_fields=["account_status"])
        self.friends_owner.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.friends_owner.profile.save(update_fields=["social_publish_visibility"])

    def test_includes_published_all_approved_owner(self):
        quote = Quote.objects.create(
            owner=self.public_owner,
            body="Visible quote",
            visibility=Quote.Visibility.PUBLISHED,
        )
        ids = set(discoverable_published_quotes_qs().values_list("id", flat=True))
        self.assertEqual(ids, {quote.id})

    def test_excludes_private_and_friends_only(self):
        Quote.objects.create(
            owner=self.public_owner,
            body="Private",
            visibility=Quote.Visibility.PRIVATE,
        )
        Quote.objects.create(
            owner=self.friends_owner,
            body="Friends only publisher",
            visibility=Quote.Visibility.PUBLISHED,
        )
        Quote.objects.create(
            owner=self.private_owner,
            body="Draft",
            visibility=Quote.Visibility.PRIVATE,
        )
        self.assertEqual(discoverable_published_quotes_qs().count(), 0)

    def test_random_returns_one_when_available(self):
        Quote.objects.create(
            owner=self.public_owner,
            body="Pick me",
            visibility=Quote.Visibility.PUBLISHED,
        )
        quote = random_discoverable_published_quote()
        self.assertIsNotNone(quote)
        self.assertEqual(quote.body, "Pick me")

    def test_random_none_when_pool_empty(self):
        self.assertIsNone(random_discoverable_published_quote())
