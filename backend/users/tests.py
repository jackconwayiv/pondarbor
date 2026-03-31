from django.contrib.auth import get_user_model
from django.http import Http404
from django.test import RequestFactory
from django.test import TestCase
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
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["profile"]["display_name"], "After")
        self.assertEqual(body["profile"]["timezone"], "America/New_York")
        self.assertEqual(body["profile"]["avatar_url"], "https://example.com/p.png")
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.display_name, "After")

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

    def test_quotes_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/quotes/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "quotes")

    def test_whatiff_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/whatiff/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "whatiff")


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
