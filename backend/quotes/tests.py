from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from friends.models import FriendRequest
from quotes.models import Quote, QuoteLabel


User = get_user_model()


class QuotesApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.bob = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.charlie = User.objects.create_user(email="charlie@example.com", password="secret12345")
        for user in (self.alice, self.bob, self.charlie):
            user.account_status = User.AccountStatus.APPROVED
            user.save(update_fields=["account_status"])

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)

        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)

        self.charlie_client = APIClient()
        self.charlie_client.force_login(self.charlie)

        self.anon_client = APIClient()

    def _accept_pair(self, user_a, user_b):
        FriendRequest.objects.update_or_create(
            requester=user_a,
            requested=user_b,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=user_b,
            requested=user_a,
            defaults={"is_accepted": True},
        )

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
        self._accept_pair(self.alice, self.bob)
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

    def test_private_quote_tagged_in_is_not_visible_in_feed(self):
        # Alice saves a private quote and attributes it to Bob.
        self._accept_pair(self.alice, self.bob)
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
        self.assertNotIn(quote_id, feed_ids)

    def test_feed_quotes_sorted_by_updated_desc(self):
        self._accept_pair(self.alice, self.bob)
        older = Quote.objects.create(
            owner=self.alice,
            body="Older",
            visibility=Quote.Visibility.PUBLISHED,
        )
        Quote.objects.filter(pk=older.pk).update(updated_at=timezone.now() - timedelta(days=2))
        newest = Quote.objects.create(
            owner=self.alice,
            body="Newest",
            visibility=Quote.Visibility.PUBLISHED,
        )
        mid = Quote.objects.create(
            owner=self.bob,
            body="Middle",
            visibility=Quote.Visibility.PUBLISHED,
        )
        Quote.objects.filter(pk=mid.pk).update(updated_at=timezone.now() - timedelta(days=1))

        resp = self.bob_client.get("/api/v1/quotes/feed/")
        self.assertEqual(resp.status_code, 200)
        ordered_ids = [q["id"] for q in resp.json()]
        self.assertGreaterEqual(len(ordered_ids), 3)
        self.assertEqual(ordered_ids[0], newest.id)
        self.assertSetEqual(set(ordered_ids[:3]), {older.id, newest.id, mid.id})

    def test_anonymous_cannot_view_private_quote_detail(self):
        create_resp = self.alice_client.post(
            "/api/v1/quotes/",
            {"body": "Private only"},
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        quote_id = create_resp.json()["id"]

        resp = self.anon_client.get(f"/api/v1/quotes/{quote_id}/")
        self.assertIn(resp.status_code, (401, 403))

    def test_published_quotes_list_requires_approved_user(self):
        published_quote = Quote.objects.create(
            owner=self.alice,
            body="Published quote",
            visibility=Quote.Visibility.PUBLISHED,
        )
        self._accept_pair(self.alice, self.bob)
        resp = self.anon_client.get("/api/v1/quotes/published/")
        self.assertIn(resp.status_code, (401, 403))
        pending = User.objects.create_user(email="pending@example.com", password="secret12345")
        pending_client = APIClient()
        pending_client.force_login(pending)
        self.assertEqual(pending_client.get("/api/v1/quotes/published/").status_code, 403)

        allowed_resp = self.bob_client.get("/api/v1/quotes/published/")
        self.assertEqual(allowed_resp.status_code, 200)
        ids = {q["id"] for q in allowed_resp.json()}
        self.assertIn(published_quote.id, ids)

    def test_published_quotes_include_own_and_friends_sorted_by_updated(self):
        self._accept_pair(self.alice, self.bob)
        older = Quote.objects.create(
            owner=self.bob,
            body="Bob published older",
            visibility=Quote.Visibility.PUBLISHED,
        )
        Quote.objects.filter(pk=older.pk).update(updated_at=timezone.now() - timedelta(days=2))
        newer = Quote.objects.create(
            owner=self.bob,
            body="Bob published newer",
            visibility=Quote.Visibility.PUBLISHED,
        )
        alice_q = Quote.objects.create(
            owner=self.alice,
            body="Alice for bob",
            visibility=Quote.Visibility.PUBLISHED,
        )
        Quote.objects.filter(pk=alice_q.pk).update(updated_at=timezone.now() - timedelta(days=1))

        resp = self.bob_client.get("/api/v1/quotes/published/")
        self.assertEqual(resp.status_code, 200)
        ordered_ids = [q["id"] for q in resp.json()]
        self.assertEqual(ordered_ids[0], newer.id)
        self.assertSetEqual(set(ordered_ids), {older.id, newer.id, alice_q.id})

    def test_public_quotes_by_user_endpoint(self):
        public_quote = Quote.objects.create(
            owner=self.alice,
            body="Alice published quote",
            visibility=Quote.Visibility.PUBLISHED,
        )
        private_quote = Quote.objects.create(
            owner=self.alice,
            body="Alice private quote",
            visibility=Quote.Visibility.PRIVATE,
        )

        anon_resp = self.anon_client.get(f"/api/v1/users/{self.alice.email}/public-quotes/")
        self.assertIn(anon_resp.status_code, (401, 403))

        self._accept_pair(self.alice, self.bob)
        resp = self.bob_client.get(f"/api/v1/users/{self.alice.email}/public-quotes/")
        self.assertEqual(resp.status_code, 200)
        ids = {q["id"] for q in resp.json()}
        self.assertIn(public_quote.id, ids)
        self.assertNotIn(private_quote.id, ids)

        by_id = self.bob_client.get(f"/api/v1/users/{self.alice.id}/public-quotes/")
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual({q["id"] for q in by_id.json()}, ids)

    def test_public_quotes_by_user_excludes_tagged_private_when_viewer_authenticated(self):
        tagged_private = Quote.objects.create(
            owner=self.alice,
            body="Private but Bob is tagged",
            visibility=Quote.Visibility.PRIVATE,
        )
        label, _ = QuoteLabel.objects.get_or_create(
            owner=self.alice,
            kind="attribution",
            name=self.bob.email,
            linked_user=self.bob,
        )
        tagged_private.labels.add(label)

        anon_resp = self.anon_client.get(f"/api/v1/users/{self.alice.id}/public-quotes/")
        self.assertIn(anon_resp.status_code, (401, 403))

        # Not-friend authenticated viewer still cannot see this quote.
        charlie_ids = {
            q["id"]
            for q in self.charlie_client.get(
                f"/api/v1/users/{self.alice.id}/public-quotes/",
            ).json()
        }
        self.assertNotIn(tagged_private.id, charlie_ids)

        self._accept_pair(self.alice, self.bob)
        self.bob_client.force_login(self.bob)
        bob_ids = {
            q["id"]
            for q in self.bob_client.get(
                f"/api/v1/users/{self.alice.id}/public-quotes/",
            ).json()
        }
        self.assertNotIn(tagged_private.id, bob_ids)

    def test_feed_query_count_is_bounded(self):
        # Ensure we don't accidentally do per-quote label lookups.
        self._accept_pair(self.alice, self.bob)
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
        # Expect a small constant number of queries. After friend-gating and owner/profile
        # serialization changes, this is still bounded but higher than the original baseline.
        self.assertLessEqual(len(ctx), 14)

    def test_delete_is_soft_and_hidden_from_feed_and_public(self):
        quote = Quote.objects.create(
            owner=self.alice,
            body="Delete me softly",
            visibility=Quote.Visibility.PUBLISHED,
        )

        delete_resp = self.alice_client.delete(f"/api/v1/quotes/{quote.id}/")
        self.assertEqual(delete_resp.status_code, 204)
        quote.refresh_from_db()
        self.assertIsNotNone(quote.deleted_at)

        feed_resp = self.alice_client.get("/api/v1/quotes/feed/")
        self.assertEqual(feed_resp.status_code, 200)
        feed_ids = {q["id"] for q in feed_resp.json()}
        self.assertNotIn(quote.id, feed_ids)

        self._accept_pair(self.alice, self.bob)
        public_resp = self.bob_client.get("/api/v1/quotes/published/")
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

    def test_unapproved_feed_shows_only_own_quotes(self):
        pending = User.objects.create_user(email="unapp-feed@example.com", password="secret12345")
        q_own = Quote.objects.create(
            owner=pending,
            body="Mine only",
            visibility=Quote.Visibility.PRIVATE,
        )
        q_bob = Quote.objects.create(
            owner=self.bob,
            body="Bob visible",
            visibility=Quote.Visibility.PUBLISHED,
        )
        pending_client = APIClient()
        pending_client.force_login(pending)
        resp = pending_client.get("/api/v1/quotes/feed/")
        self.assertEqual(resp.status_code, 200)
        ids = {x["id"] for x in resp.json()}
        self.assertEqual(ids, {q_own.id})
        detail = pending_client.get(f"/api/v1/quotes/{q_bob.id}/")
        self.assertEqual(detail.status_code, 404)

