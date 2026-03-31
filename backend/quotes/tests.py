from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient

from quotes.models import Quote, QuoteLabel


User = get_user_model()


class QuotesApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.bob = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.charlie = User.objects.create_user(email="charlie@example.com", password="secret12345")

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)

        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)

        self.anon_client = APIClient()

    def test_quick_create_requires_body_and_sets_defaults(self):
        resp = self.alice_client.post("/api/v1/quotes/", {"body": " Hello world "}, format="json")
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["body"], "Hello world")
        self.assertEqual(body["owner"]["id"], self.alice.id)
        self.assertEqual(body["visibility"], "private")
        self.assertIsNotNone(body["created_at"])
        self.assertEqual(body["labels"], [])

    def test_attribution_unknown_email_returns_400(self):
        resp = self.alice_client.post(
            "/api/v1/quotes/",
            {
                "body": "Cited",
                "labels": [{"kind": "attribution", "email": "not-a-user@example.com"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        errs = payload.get("labels") or payload.get("detail") or []
        if isinstance(errs, str):
            errs = [errs]
        self.assertTrue(
            any("not currently registered" in str(e).lower() for e in errs),
            msg=payload,
        )

    def test_attribution_by_email_stores_full_user_email_as_label_name(self):
        create_resp = self.alice_client.post(
            "/api/v1/quotes/",
            {
                "body": "Cited",
                "labels": [{"kind": "attribution", "email": self.bob.email}],
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        labels = create_resp.json()["labels"]
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels[0]["name"], self.bob.email)
        self.assertEqual(labels[0]["linked_user_id"], self.bob.id)

    def test_private_quote_tagged_in_is_visible_in_feed(self):
        # Alice saves a private quote and attributes it to Bob.
        create_resp = self.alice_client.post(
            "/api/v1/quotes/",
            {
                "body": "Test quote",
                "visibility": "private",
                "labels": [{"kind": "attribution", "email": self.bob.email}],
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        quote_id = create_resp.json()["id"]

        feed_resp = self.bob_client.get("/api/v1/quotes/feed/")
        self.assertEqual(feed_resp.status_code, 200)
        feed_ids = {q["id"] for q in feed_resp.json()}
        self.assertIn(quote_id, feed_ids)

    def test_anonymous_cannot_view_private_quote_detail(self):
        create_resp = self.alice_client.post(
            "/api/v1/quotes/",
            {"body": "Private only"},
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        quote_id = create_resp.json()["id"]

        resp = self.anon_client.get(f"/api/v1/quotes/{quote_id}/")
        self.assertEqual(resp.status_code, 404)

    def test_anonymous_can_view_public_quotes_list(self):
        public_quote = Quote.objects.create(
            owner=self.alice,
            body="Public quote",
            visibility=Quote.Visibility.PUBLIC,
        )
        resp = self.anon_client.get("/api/v1/quotes/public/")
        self.assertEqual(resp.status_code, 200)
        ids = {q["id"] for q in resp.json()}
        self.assertIn(public_quote.id, ids)

    def test_public_quotes_by_user_endpoint(self):
        public_quote = Quote.objects.create(
            owner=self.alice,
            body="Alice public quote",
            visibility=Quote.Visibility.PUBLIC,
        )
        private_quote = Quote.objects.create(
            owner=self.alice,
            body="Alice private quote",
            visibility=Quote.Visibility.PRIVATE,
        )

        resp = self.anon_client.get(f"/api/v1/users/{self.alice.email}/public-quotes/")
        self.assertEqual(resp.status_code, 200)
        ids = {q["id"] for q in resp.json()}
        self.assertIn(public_quote.id, ids)
        self.assertNotIn(private_quote.id, ids)

    def test_feed_query_count_is_bounded(self):
        # Ensure we don't accidentally do per-quote label lookups.
        for i in range(5):
            q = Quote.objects.create(owner=self.alice, body=f"Q{i}", visibility=Quote.Visibility.PRIVATE)
            # Attach an attribution label to each quote so Bob is linked.
            label, _ = QuoteLabel.objects.get_or_create(
                owner=self.alice,
                kind="attribution",
                name=self.bob.email,
                linked_user=self.bob,
            )
            q.labels.add(label)

        with CaptureQueriesContext(connection) as ctx:
            resp = self.bob_client.get("/api/v1/quotes/feed/")
        self.assertEqual(resp.status_code, 200)
        # Expect a small constant number of queries:
        # - quotes (+ join for labels__linked_user)
        # - prefetch labels (+ linked_user select)
        self.assertLessEqual(len(ctx), 6)

    def test_delete_is_soft_and_hidden_from_feed_and_public(self):
        quote = Quote.objects.create(
            owner=self.alice,
            body="Delete me softly",
            visibility=Quote.Visibility.PUBLIC,
        )

        delete_resp = self.alice_client.delete(f"/api/v1/quotes/{quote.id}/")
        self.assertEqual(delete_resp.status_code, 204)
        quote.refresh_from_db()
        self.assertIsNotNone(quote.deleted_at)

        feed_resp = self.alice_client.get("/api/v1/quotes/feed/")
        self.assertEqual(feed_resp.status_code, 200)
        feed_ids = {q["id"] for q in feed_resp.json()}
        self.assertNotIn(quote.id, feed_ids)

        public_resp = self.anon_client.get("/api/v1/quotes/public/")
        self.assertEqual(public_resp.status_code, 200)
        public_ids = {q["id"] for q in public_resp.json()}
        self.assertNotIn(quote.id, public_ids)

    def test_soft_deleted_quote_not_retrievable(self):
        quote = Quote.objects.create(
            owner=self.alice,
            body="Soon gone",
            visibility=Quote.Visibility.PRIVATE,
        )
        quote.deleted_at = quote.created_at
        quote.save(update_fields=["deleted_at"])

        owner_resp = self.alice_client.get(f"/api/v1/quotes/{quote.id}/")
        self.assertEqual(owner_resp.status_code, 404)

