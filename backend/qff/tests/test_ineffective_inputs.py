"""Logging unknown commands and staff DM API for QffIneffectiveInput."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.models import Character, CharacterClass, QffIneffectiveInput, Room

User = get_user_model()


def _room(slug: str) -> Room:
    from qff.models import Area

    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


def _approved_user(email: str, *, staff: bool = False) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = staff
    u.save(update_fields=["account_status", "is_staff"])
    return u


class IneffectiveInputTests(TestCase):
    def setUp(self):
        self.room = _room("ineff-test")
        self.cc = CharacterClass.objects.create(slug="war-ineff", name="Warrior", sort_order=0)

    def _character(self, user: User) -> Character:
        return Character.objects.create(
            user=user,
            name="Hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_unknown_command_creates_row_via_api(self):
        u = _approved_user("player@example.com")
        self._character(u)
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "xyzzy plugh"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["messages"][0], "You try that, but nothing happens.")
        row = QffIneffectiveInput.objects.get()
        self.assertEqual(row.user_id, u.id)
        self.assertEqual(row.user_email, "player@example.com")
        self.assertEqual(row.raw_line, "xyzzy plugh")
        self.assertEqual(row.room_id, self.room.id)
        self.assertEqual(row.room_name, self.room.name)

    def test_known_command_does_not_create_row(self):
        u = _approved_user("player2@example.com")
        self._character(u)
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "look"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(QffIneffectiveInput.objects.count(), 0)

    def test_staff_can_list_and_delete(self):
        u = _approved_user("staff@example.com", staff=True)
        self._character(u)
        client = APIClient()
        client.force_login(u)
        client.post("/api/v1/qff/command/", {"line": "nope"}, format="json")
        row = QffIneffectiveInput.objects.get()

        res = client.get("/api/v1/qff/dm/ineffective-inputs/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(len(body["results"]), 1)
        self.assertEqual(body["results"][0]["raw_line"], "nope")
        self.assertEqual(body["results"][0]["room_id"], self.room.id)
        self.assertEqual(body["results"][0]["room_name"], self.room.name)

        res = client.delete(f"/api/v1/qff/dm/ineffective-inputs/{row.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(QffIneffectiveInput.objects.count(), 0)

    def test_non_staff_cannot_list(self):
        u = _approved_user("plain@example.com", staff=False)
        self._character(u)
        client = APIClient()
        client.force_login(u)
        res = client.get("/api/v1/qff/dm/ineffective-inputs/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_staff_cannot_delete(self):
        staff_u = _approved_user("owner@example.com", staff=True)
        plain_u = _approved_user("plain2@example.com", staff=False)
        self._character(staff_u)
        client = APIClient()
        client.force_login(staff_u)
        client.post("/api/v1/qff/command/", {"line": "zzz"}, format="json")
        row = QffIneffectiveInput.objects.get()
        client.logout()
        client.force_login(plain_u)
        res = client.delete(f"/api/v1/qff/dm/ineffective-inputs/{row.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(QffIneffectiveInput.objects.count(), 1)
