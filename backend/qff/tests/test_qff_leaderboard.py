"""QFF public-ish leaderboard (approved users, 30d activity)."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.models import Area, Character, CharacterClass, Room

User = get_user_model()

LEADERBOARD_URL = "/api/v1/qff/leaderboard/"


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"LB-{slug}",
        slug=f"area-lb-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


class QffLeaderboardApiTests(TestCase):
    def setUp(self):
        self.room = _room("lb-row")
        self.cc = CharacterClass.objects.create(slug="cl-lb", name="Tester", sort_order=0)

    def _char(self, name: str, user: User, **kwargs) -> Character:
        d = {
            "user": user,
            "name": name,
            "character_class": self.cc,
            "current_room": self.room,
            "spawn_room": self.room,
            "last_activity_at": timezone.now(),
        }
        d.update(kwargs)
        return Character.objects.create(**d)

    def test_approved_user_gets_list_ordered_by_xp(self):
        u_viewer = _approved_user("viewer@lb.example.com")
        u1 = _approved_user("a@lb.example.com")
        u2 = _approved_user("b@lb.example.com")
        self._char("Zed", u1, xp=10, level=1)
        self._char("Amy", u2, xp=500, level=5)

        c = APIClient()
        c.force_authenticate(u_viewer)
        r = c.get(LEADERBOARD_URL)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.content)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 2)
        # Highest XP first
        idx_high = next(i for i, row in enumerate(data) if row["name"] == "Amy")
        idx_low = next(i for i, row in enumerate(data) if row["name"] == "Zed")
        self.assertLess(idx_high, idx_low)
        amy = next((row for row in data if row["name"] == "Amy"), None)
        self.assertIsNotNone(amy)
        assert amy is not None
        self.assertEqual(amy["level"], 5)
        self.assertEqual(amy["xp"], 500)
        self.assertEqual(amy["class_name"], "Tester")
        self.assertEqual(amy["class_slug"], "cl-lb")

    def test_inactive_older_than_30_days_excluded(self):
        u_viewer = _approved_user("v2@lb.example.com")
        u_stale = _approved_user("stale@lb.example.com")
        self._char(
            "Old",
            u_stale,
            xp=9999,
            last_activity_at=timezone.now() - timedelta(days=31),
        )

        c = APIClient()
        c.force_authenticate(u_viewer)
        r = c.get(LEADERBOARD_URL)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = {row["name"] for row in r.json()}
        self.assertNotIn("Old", names)

    def test_non_approved_forbidden(self):
        u = User.objects.create_user(email="pend@lb.example.com", password="x")
        u.account_status = User.AccountStatus.PENDING
        u.save(update_fields=["account_status"])
        c = APIClient()
        c.force_authenticate(u)
        r = c.get(LEADERBOARD_URL)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
