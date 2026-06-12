from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from estates.bot_user import get_computer_user
from friends.models import FriendRequest
from friends.slack_notify import notify_incoming_friend_request
from slack_integration.models import SlackIdentity
from users.models import Profile

User = get_user_model()


class FriendsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.anon = APIClient()

        self.alice = self._make_user("alice@example.com", approved=True, display_name="Alice")
        self.bob = self._make_user("bob@example.com", approved=True, display_name="Bob")
        self.charlie = self._make_user(
            "charlie@example.com", approved=True, display_name="Charlie"
        )
        self.pending_user = self._make_user("pending@example.com", approved=False)

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)
        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)
        self.pending_client = APIClient()
        self.pending_client.force_login(self.pending_user)

    def _make_user(self, email: str, *, approved: bool, display_name: str = ""):
        user = User.objects.create_user(email=email, password="secret12345")
        user.account_status = (
            User.AccountStatus.APPROVED if approved else User.AccountStatus.PENDING
        )
        user.save(update_fields=["account_status"])
        Profile.objects.update_or_create(
            user=user,
            defaults={"display_name": display_name, "avatar_url": ""},
        )
        return user

    def _accept_pair(self, a, b):
        FriendRequest.objects.update_or_create(
            requester=a,
            requested=b,
            defaults={
                "is_accepted": True,
                "ignored_by_requester": False,
                "ignored_by_requested": False,
            },
        )
        FriendRequest.objects.update_or_create(
            requester=b,
            requested=a,
            defaults={
                "is_accepted": True,
                "ignored_by_requester": False,
                "ignored_by_requested": False,
            },
        )

    def test_permissions_require_approved_user(self):
        endpoints = [
            ("get", "/api/v1/friends/"),
            ("get", "/api/v1/friends/approved-users/"),
            ("post", "/api/v1/friends/request/"),
            ("post", f"/api/v1/friends/{self.bob.id}/request/"),
            ("post", f"/api/v1/friends/{self.bob.id}/accept/"),
            ("post", f"/api/v1/friends/{self.bob.id}/ignore/"),
            ("post", f"/api/v1/friends/{self.bob.id}/unfriend/"),
            ("get", "/api/v1/friends/search/?q=bo"),
            ("get", "/api/v1/friends/approved-users/search/?q=bo"),
        ]
        for method, path in endpoints:
            resp_anon = getattr(self.anon, method)(
                path, {"email": self.bob.email} if method == "post" else None, format="json"
            )
            self.assertIn(resp_anon.status_code, (401, 403), msg=path)

            resp_pending = getattr(self.pending_client, method)(
                path, {"email": self.bob.email} if method == "post" else None, format="json"
            )
            self.assertEqual(resp_pending.status_code, 403, msg=path)

    def test_request_friend_by_email_happy_path(self):
        resp = self.alice_client.post(
            "/api/v1/friends/request/",
            {"email": self.bob.email},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"ok": True, "state": "requested"})
        self.assertTrue(
            FriendRequest.objects.filter(requester=self.alice, requested=self.bob).exists()
        )

    def test_request_friend_by_id_happy_path(self):
        resp = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/request/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["state"], "requested")
        self.assertTrue(
            FriendRequest.objects.filter(requester=self.alice, requested=self.bob).exists()
        )

    def test_request_friend_rejects_self_and_unapproved_target(self):
        self_resp = self.alice_client.post(
            "/api/v1/friends/request/",
            {"email": self.alice.email},
            format="json",
        )
        self.assertEqual(self_resp.status_code, 400)
        self.assertIn("yourself", self_resp.json()["detail"].lower())

        pending_resp = self.alice_client.post(
            "/api/v1/friends/request/",
            {"email": self.pending_user.email},
            format="json",
        )
        self.assertEqual(pending_resp.status_code, 400)
        self.assertIn("not available", pending_resp.json()["detail"].lower())

    def test_request_friend_returns_already_friends_when_pair_is_accepted(self):
        self._accept_pair(self.alice, self.bob)
        resp = self.alice_client.post(
            "/api/v1/friends/request/",
            {"email": self.bob.email},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["state"], "already_friends")
        self.assertEqual(
            FriendRequest.objects.filter(
                requester=self.alice, requested=self.bob, is_accepted=True
            ).count(),
            1,
        )
        self.assertEqual(
            FriendRequest.objects.filter(
                requester=self.bob, requested=self.alice, is_accepted=True
            ).count(),
            1,
        )

    def test_accept_friend_creates_mutual_accepted_rows_and_is_idempotent(self):
        resp = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/accept/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            FriendRequest.objects.filter(
                requester=self.alice, requested=self.bob, is_accepted=True
            ).exists()
        )
        self.assertTrue(
            FriendRequest.objects.filter(
                requester=self.bob, requested=self.alice, is_accepted=True
            ).exists()
        )

        again = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/accept/", format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(
            FriendRequest.objects.filter(requester=self.alice, requested=self.bob).count(),
            1,
        )
        self.assertEqual(
            FriendRequest.objects.filter(requester=self.bob, requested=self.alice).count(),
            1,
        )

    def test_accept_friend_rejects_self(self):
        resp = self.alice_client.post(f"/api/v1/friends/{self.alice.id}/accept/", format="json")
        self.assertEqual(resp.status_code, 400)

    def test_ignore_friend_deletes_both_directions_and_is_idempotent(self):
        FriendRequest.objects.create(requester=self.alice, requested=self.bob)
        FriendRequest.objects.create(requester=self.bob, requested=self.alice)

        resp = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/ignore/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            FriendRequest.objects.filter(
                requester=self.alice, requested=self.bob
            ).exists()
        )
        self.assertFalse(
            FriendRequest.objects.filter(
                requester=self.bob, requested=self.alice
            ).exists()
        )

        again = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/ignore/", format="json")
        self.assertEqual(again.status_code, 200)

    def test_unfriend_deletes_both_directions_and_is_idempotent(self):
        self._accept_pair(self.alice, self.bob)
        resp = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/unfriend/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            FriendRequest.objects.filter(
                requester=self.alice, requested=self.bob
            ).exists()
        )
        self.assertFalse(
            FriendRequest.objects.filter(
                requester=self.bob, requested=self.alice
            ).exists()
        )
        again = self.alice_client.post(f"/api/v1/friends/{self.bob.id}/unfriend/", format="json")
        self.assertEqual(again.status_code, 200)

    def test_friends_list_shapes_pending_and_approved_sections(self):
        FriendRequest.objects.create(requester=self.bob, requested=self.alice)  # incoming
        FriendRequest.objects.create(
            requester=self.alice, requested=self.charlie
        )  # outgoing
        self._accept_pair(self.alice, self.pending_user)

        resp = self.alice_client.get("/api/v1/friends/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["pending_count"], 1)
        self.assertEqual([r["id"] for r in body["incoming_pending"]], [self.bob.id])
        self.assertEqual(
            [r["id"] for r in body["outgoing_pending"]], [self.charlie.id]
        )
        self.assertEqual(
            [r["id"] for r in body["approved_friends"]], [self.pending_user.id]
        )
        for section in (
            body["incoming_pending"],
            body["outgoing_pending"],
            body["approved_friends"],
        ):
            for row in section:
                self.assertNotIn("email", row)
                self.assertIn("meal_crud_partner_id", row)

    def test_friends_search_returns_only_approved_friends(self):
        self._accept_pair(self.alice, self.bob)
        FriendRequest.objects.create(requester=self.alice, requested=self.charlie)

        resp = self.alice_client.get("/api/v1/friends/search/?q=bo")
        self.assertEqual(resp.status_code, 200)
        ids = [row["id"] for row in resp.json()]
        self.assertEqual(ids, [self.bob.id])
        for row in resp.json():
            self.assertNotIn("email", row)

    def test_approved_users_search_filters_and_excludes_self(self):
        resp_short = self.alice_client.get("/api/v1/friends/approved-users/search/?q=b")
        self.assertEqual(resp_short.status_code, 200)
        self.assertEqual(resp_short.json(), [])

        resp = self.alice_client.get("/api/v1/friends/approved-users/search/?q=example")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertIn(self.bob.id, ids)
        self.assertIn(self.charlie.id, ids)
        self.assertNotIn(self.alice.id, ids)
        self.assertNotIn(self.pending_user.id, ids)
        for row in resp.json():
            self.assertNotIn("email", row)

    def test_approved_users_list_excludes_self_friends_and_pending(self):
        self._accept_pair(self.alice, self.bob)
        FriendRequest.objects.create(requester=self.alice, requested=self.charlie)
        dave = self._make_user("dave@example.com", approved=True, display_name="Dave")

        resp = self.alice_client.get("/api/v1/friends/approved-users/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertIn(dave.id, ids)
        self.assertNotIn(self.alice.id, ids)
        self.assertNotIn(self.bob.id, ids)
        self.assertNotIn(self.charlie.id, ids)
        self.assertNotIn(self.pending_user.id, ids)

    def test_approved_users_list_excludes_hidden_system_accounts(self):
        computer = get_computer_user()
        computer.account_status = User.AccountStatus.APPROVED
        computer.save(update_fields=["account_status"])
        Profile.objects.update_or_create(
            user=computer,
            defaults={"display_name": "Computer", "avatar_url": ""},
        )
        self._make_user(
            settings.CONTACT_INBOX_EMAIL,
            approved=True,
            display_name="PondArbor",
        )

        list_resp = self.alice_client.get("/api/v1/friends/approved-users/")
        self.assertEqual(list_resp.status_code, 200)
        for row in list_resp.json():
            self.assertNotIn("email", row)
        nicknames = {row["nickname"] for row in list_resp.json()}
        self.assertNotIn("Computer", nicknames)
        self.assertNotIn("PondArbor", nicknames)

        search_resp = self.alice_client.get(
            "/api/v1/friends/approved-users/search/?q=estates-computer"
        )
        self.assertEqual(search_resp.status_code, 200)
        for row in search_resp.json():
            self.assertNotIn("email", row)

        contact_search = self.alice_client.get(
            f"/api/v1/friends/approved-users/search/?q={settings.CONTACT_INBOX_EMAIL.split('@')[0]}"
        )
        self.assertEqual(contact_search.status_code, 200)
        for row in contact_search.json():
            self.assertNotIn("email", row)

    def test_approved_users_list_excludes_friends_only_non_friend(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])

        resp = self.alice_client.get("/api/v1/friends/approved-users/")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertNotIn(self.bob.id, ids)

    def test_approved_users_search_still_finds_friends_only(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])

        resp = self.alice_client.get("/api/v1/friends/approved-users/search/?q=bob")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertIn(self.bob.id, ids)

    def test_approved_users_list_ordered_by_recent_activity(self):
        self.bob.profile.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        self.bob.profile.save(update_fields=["social_publish_visibility"])
        now = timezone.now()
        User.objects.filter(pk=self.charlie.pk).update(
            last_login=now - timedelta(days=10)
        )
        dave = self._make_user("dave@example.com", approved=True, display_name="Dave")
        User.objects.filter(pk=dave.pk).update(last_login=now - timedelta(days=1))

        resp = self.alice_client.get("/api/v1/friends/approved-users/")
        self.assertEqual(resp.status_code, 200)
        ids = [row["id"] for row in resp.json()]
        self.assertEqual(ids, [dave.id, self.charlie.id])

    def test_approved_friends_ordered_by_recent_activity(self):
        self._accept_pair(self.alice, self.bob)
        self._accept_pair(self.alice, self.charlie)
        now = timezone.now()
        User.objects.filter(pk=self.bob.pk).update(last_login=now - timedelta(days=1))
        User.objects.filter(pk=self.charlie.pk).update(
            last_login=now - timedelta(days=10)
        )

        resp = self.alice_client.get("/api/v1/friends/")
        self.assertEqual(resp.status_code, 200)
        ids = [row["id"] for row in resp.json()["approved_friends"]]
        self.assertEqual(ids, [self.bob.id, self.charlie.id])

    def test_ignore_then_rerequest_does_not_create_false_reverse_incoming(self):
        # A requests B.
        self.alice_client.post(
            "/api/v1/friends/request/", {"email": self.bob.email}, format="json"
        )
        # B ignores.
        self.bob_client.post(f"/api/v1/friends/{self.alice.id}/ignore/", format="json")
        # A re-requests.
        self.alice_client.post(
            "/api/v1/friends/request/", {"email": self.bob.email}, format="json"
        )

        a_list = self.alice_client.get("/api/v1/friends/").json()
        b_list = self.bob_client.get("/api/v1/friends/").json()

        self.assertEqual(a_list["incoming_pending"], [])
        self.assertEqual([r["id"] for r in a_list["outgoing_pending"]], [self.bob.id])
        self.assertEqual([r["id"] for r in b_list["incoming_pending"]], [self.alice.id])
        self.assertEqual(b_list["outgoing_pending"], [])


class FriendRequestModelTests(TestCase):
    def test_unique_pair_constraint(self):
        a = User.objects.create_user(email="a@example.com", password="secret12345")
        b = User.objects.create_user(email="b@example.com", password="secret12345")
        FriendRequest.objects.create(requester=a, requested=b)
        with self.assertRaises(IntegrityError):
            FriendRequest.objects.create(requester=a, requested=b)

    def test_self_request_check_constraint(self):
        a = User.objects.create_user(email="a@example.com", password="secret12345")
        with self.assertRaises(IntegrityError):
            FriendRequest.objects.create(requester=a, requested=a)


@override_settings(
    PONDARBOR_ORIGIN="https://www.pondarbor.com",
    SLACK_FRIEND_NOTIFICATIONS_ENABLED=True,
    SLACK_BOT_TOKEN="xoxb-test",
)
class FriendSlackNotifyTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        self.alice.account_status = User.AccountStatus.APPROVED
        self.alice.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.alice, defaults={"display_name": "Alice"})

        self.bob = User.objects.create_user(email="bob@example.com", password="secret12345")
        self.bob.account_status = User.AccountStatus.APPROVED
        self.bob.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.bob, defaults={"display_name": "Bob"})
        SlackIdentity.objects.create(team_id="T1", slack_user_id="U_bob", user=self.bob)

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)

    @mock.patch("friends.slack_notify.notify_pondarbor_user_dm")
    def test_new_friend_request_notifies_requested_user(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.alice_client.post(
                "/api/v1/friends/request/",
                {"email": self.bob.email},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        mock_dm.assert_called_once()
        kwargs = mock_dm.call_args.kwargs
        self.assertEqual(kwargs["feature"], "friends")
        self.assertIn("Alice", kwargs["text"])
        blocks_str = str(kwargs["blocks"])
        self.assertIn("friends_accept", blocks_str)
        self.assertIn("friends_decline", blocks_str)
        self.assertIn("tab=friends", blocks_str)

    @mock.patch("friends.slack_notify.notify_pondarbor_user_dm")
    def test_duplicate_pending_request_does_not_spam(self, mock_dm):
        FriendRequest.objects.create(requester=self.alice, requested=self.bob)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.alice_client.post(
                "/api/v1/friends/request/",
                {"email": self.bob.email},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        mock_dm.assert_not_called()

    @mock.patch("friends.slack_notify.notify_pondarbor_user_dm")
    def test_unignore_pending_request_notifies_again(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        FriendRequest.objects.create(
            requester=self.alice,
            requested=self.bob,
            ignored_by_requested=True,
        )
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.alice_client.post(
                "/api/v1/friends/request/",
                {"email": self.bob.email},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        mock_dm.assert_called_once()

    @mock.patch("friends.slack_notify.notify_pondarbor_user_dm")
    def test_notify_helper_uses_display_name(self, mock_dm):
        mock_dm.return_value = {"ok": True}
        notify_incoming_friend_request(requested=self.bob, requester=self.alice)
        self.assertIn("Alice", mock_dm.call_args.kwargs["text"])

