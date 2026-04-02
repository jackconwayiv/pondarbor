from django.contrib.auth import get_user_model
from datetime import timedelta
from django.http import Http404
from django.test import RequestFactory
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from users.frontend_views import spa_index

User = get_user_model()


class UsersApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_creates_profile_and_me_shape(self):
        response = self.client.post(
            "/api/v1/users/signup/",
            {
                "email": "new@example.com",
                "password": "goodpass12",
                "display_name": "Nick",
                "timezone": "UTC",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertIn("user", body)
        self.assertIn("profile", body)
        self.assertEqual(body["user"]["email"], "new@example.com")
        self.assertEqual(body["user"]["account_status"], "pending")
        self.assertFalse(body["user"]["is_approved"])
        self.assertNotIn("status", body["profile"])
        self.assertEqual(body["profile"]["display_name"], "Nick")
        self.assertIsNone(body["profile"]["birth_date"])

    def test_me_requires_authentication(self):
        response = self.client.get("/api/v1/users/me/")
        self.assertIn(response.status_code, (401, 403))

    def test_me_returns_authenticated_user_only(self):
        user = User.objects.create_user(email="self@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["user"]["email"], "self@example.com")
        self.assertEqual(body["user"]["id"], user.id)

    def test_patch_profile_updates_preferences_and_returns_full_me(self):
        user = User.objects.create_user(email="edit@example.com", password="secret12345")
        user.profile.display_name = "Before"
        user.profile.save()
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {
                "display_name": "After",
                "timezone": "America/New_York",
                "avatar_url": "https://example.com/p.png",
                "birth_date": "1990-05-17",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["profile"]["display_name"], "After")
        self.assertEqual(body["profile"]["timezone"], "America/New_York")
        self.assertEqual(body["profile"]["avatar_url"], "https://example.com/p.png")
        self.assertEqual(body["profile"]["birth_date"], "1990-05-17")
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.display_name, "After")
        self.assertEqual(str(user.profile.birth_date), "1990-05-17")

    def test_patch_profile_allows_clearing_birth_date(self):
        user = User.objects.create_user(email="clear@example.com", password="secret12345")
        user.profile.birth_date = "1990-05-17"
        user.profile.save()
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"birth_date": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIsNone(body["profile"]["birth_date"])
        user.profile.refresh_from_db()
        self.assertIsNone(user.profile.birth_date)

    def test_patch_profile_rejects_invalid_birth_date(self):
        user = User.objects.create_user(email="invalid@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"birth_date": "not-a-date"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("birth_date", body)

    def test_patch_profile_forbidden_when_anonymous(self):
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"display_name": "X"},
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_approved_check_forbidden_when_pending(self):
        user = User.objects.create_user(email="pend@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/approved-check/")
        self.assertEqual(response.status_code, 403)

    def test_approved_check_ok_when_approved(self):
        user = User.objects.create_user(email="ok@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/approved-check/")
        self.assertEqual(response.status_code, 200)

    def test_upcoming_birthdays_forbidden_when_pending(self):
        caller = User.objects.create_user(email="pend@example.com", password="secret12345")
        self.client.force_login(caller)
        response = self.client.get("/api/v1/users/upcoming-birthdays/")
        self.assertEqual(response.status_code, 403)

    def test_upcoming_birthdays_returns_only_approved_users_in_window(self):
        caller = User.objects.create_user(email="caller@example.com", password="secret12345")
        caller.account_status = User.AccountStatus.APPROVED
        caller.save()
        self.client.force_login(caller)

        today = timezone.localdate()

        in_future = User.objects.create_user(
            email="future@example.com", password="secret12345"
        )
        in_future.account_status = User.AccountStatus.APPROVED
        in_future.save()
        in_future.profile.display_name = "FutureNick"
        in_future.profile.birth_date = today + timedelta(days=7)
        in_future.profile.save()

        in_past = User.objects.create_user(email="past@example.com", password="secret12345")
        in_past.account_status = User.AccountStatus.APPROVED
        in_past.save()
        in_past.profile.display_name = "PastNick"
        in_past.profile.birth_date = today - timedelta(days=2)
        in_past.profile.save()

        out_future = User.objects.create_user(
            email="outfuture@example.com", password="secret12345"
        )
        out_future.account_status = User.AccountStatus.APPROVED
        out_future.save()
        out_future.profile.display_name = "OutFutureNick"
        out_future.profile.birth_date = today + timedelta(days=8)
        out_future.profile.save()

        out_past = User.objects.create_user(
            email="outpast@example.com", password="secret12345"
        )
        out_past.account_status = User.AccountStatus.APPROVED
        out_past.save()
        out_past.profile.display_name = "OutPastNick"
        out_past.profile.birth_date = today - timedelta(days=3)
        out_past.profile.save()

        pending_in_range = User.objects.create_user(
            email="pendingrange@example.com", password="secret12345"
        )
        pending_in_range.profile.display_name = "PendingNick"
        pending_in_range.profile.birth_date = today + timedelta(days=1)
        pending_in_range.profile.save()

        no_birth_date = User.objects.create_user(
            email="nobday@example.com", password="secret12345"
        )
        no_birth_date.account_status = User.AccountStatus.APPROVED
        no_birth_date.save()
        no_birth_date.profile.display_name = "NoBirthDateNick"
        no_birth_date.profile.birth_date = None
        no_birth_date.profile.save()

        response = self.client.get("/api/v1/users/upcoming-birthdays/")
        self.assertEqual(response.status_code, 200)
        body = response.json()

        self.assertEqual([row["display_name"] for row in body], ["PastNick", "FutureNick"])
        self.assertEqual(body[0]["birth_month"], (today - timedelta(days=2)).month)
        self.assertEqual(body[0]["birth_day"], (today - timedelta(days=2)).day)
        self.assertEqual(body[1]["birth_month"], (today + timedelta(days=7)).month)
        self.assertEqual(body[1]["birth_day"], (today + timedelta(days=7)).day)

        for row in body:
            self.assertEqual(set(row.keys()), {"display_name", "birth_month", "birth_day"})
            self.assertNotIn("email", row)
            self.assertNotIn("id", row)
            self.assertNotIn("birth_year", row)

    def test_quotes_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/quotes/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "quotes")

    def test_whatif_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/whatif/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "whatif")


class UserVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_me_never_exposes_another_accounts_identity(self):
        alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        User.objects.create_user(email="bob@example.com", password="secret12345")
        self.client.force_login(alice)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["user"]["email"], "alice@example.com")
        self.assertEqual(body["user"]["id"], alice.id)
        self.assertNotIn("bob@example.com", str(body))


class SpaRoutingTests(TestCase):
    def test_spa_index_accepts_catch_all_route_kwarg(self):
        request = RequestFactory().get("/quotes")
        try:
            response = spa_index(request, route="quotes")
        except Http404:
            # Valid in environments where frontend build artifacts are absent.
            return
        except TypeError as exc:
            self.fail(f"spa_index should accept catch-all route kwarg: {exc}")

        # Valid in environments where frontend build artifacts are present.
        self.assertEqual(response.status_code, 200)
