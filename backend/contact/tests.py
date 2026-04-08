from django.core import mail
from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model

User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CONTACT_INBOX_EMAIL="inbox@example.com",
)
class ContactApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(email="sender@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.client.force_login(self.user)

    def test_requires_message(self):
        resp = self.client.post("/api/v1/contact/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_sends_mail(self):
        resp = self.client.post(
            "/api/v1/contact/",
            {"message": "Hello from tests", "website": ""},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("sender@example.com", mail.outbox[0].subject)
        self.assertIn("Hello from tests", mail.outbox[0].body)

    def test_honeypot_rejects(self):
        resp = self.client.post(
            "/api/v1/contact/",
            {"message": "spam", "website": "http://evil"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_rate_limit(self):
        for i in range(3):
            resp = self.client.post(
                "/api/v1/contact/",
                {"message": f"msg {i}", "website": ""},
                format="json",
            )
            self.assertEqual(resp.status_code, 200, msg=f"iteration {i}")
        resp = self.client.post(
            "/api/v1/contact/",
            {"message": "one too many", "website": ""},
            format="json",
        )
        self.assertEqual(resp.status_code, 429)
