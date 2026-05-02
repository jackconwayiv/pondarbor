from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from contact.models import ContactMessage
from django.contrib.auth import get_user_model

User = get_user_model()


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

    def test_stores_message(self):
        resp = self.client.post(
            "/api/v1/contact/",
            {"message": "Hello from tests", "website": ""},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        cm = ContactMessage.objects.get(from_user=self.user)
        self.assertEqual(cm.message, "Hello from tests")

    def test_honeypot_rejects(self):
        resp = self.client.post(
            "/api/v1/contact/",
            {"message": "spam", "website": "http://evil"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(ContactMessage.objects.count(), 0)

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


class ContactStaffApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_staff_messages_forbidden_for_non_staff(self):
        user = User.objects.create_user(email="plain@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.get("/api/v1/contact/staff/messages/")
        self.assertEqual(response.status_code, 403)

    def test_staff_messages_lists_rows(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        sender = User.objects.create_user(email="snd@example.com", password="secret12345")
        sender.account_status = User.AccountStatus.APPROVED
        sender.save()
        ContactMessage.objects.create(from_user=sender, message="Need help")
        self.client.force_login(staff)
        response = self.client.get("/api/v1/contact/staff/messages/")
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["message"], "Need help")
        self.assertEqual(rows[0]["from_user"]["email"], "snd@example.com")
        self.assertIsNone(rows[0]["read_at"])
        self.assertIsNone(rows[0]["read_by"])

    def test_staff_acknowledge_marks_read(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        sender = User.objects.create_user(email="snd2@example.com", password="secret12345")
        sender.account_status = User.AccountStatus.APPROVED
        sender.save()
        cm = ContactMessage.objects.create(from_user=sender, message="Hello")
        self.client.force_login(staff)
        resp = self.client.post("/api/v1/contact/staff/messages/acknowledge/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["updated"], 1)
        cm.refresh_from_db()
        self.assertIsNotNone(cm.read_at)
        self.assertEqual(cm.read_by_id, staff.id)

    def test_staff_acknowledge_forbidden_for_non_staff(self):
        user = User.objects.create_user(email="plain2@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.post("/api/v1/contact/staff/messages/acknowledge/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_staff_delete_message(self):
        staff = User.objects.create_user(
            email="staff3@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        sender = User.objects.create_user(email="snd3@example.com", password="secret12345")
        sender.account_status = User.AccountStatus.APPROVED
        sender.save()
        cm = ContactMessage.objects.create(from_user=sender, message="Delete me")
        self.client.force_login(staff)
        response = self.client.delete(f"/api/v1/contact/staff/messages/{cm.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_staff_delete_not_found(self):
        staff = User.objects.create_user(
            email="staff4@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        self.client.force_login(staff)
        response = self.client.delete("/api/v1/contact/staff/messages/99999/")
        self.assertEqual(response.status_code, 404)
