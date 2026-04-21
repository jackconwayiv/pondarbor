"""Deadlock mitigation: advisory lock on lazy sim; command post-commit retry."""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.db.utils import OperationalError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.models import Area, Character, CharacterClass, Room
from qff.monster_sim import run_lazy_simulation

User = get_user_model()


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
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


class RunLazySimulationAdvisoryLockTests(TestCase):
    @patch("qff.monster_sim.connection")
    def test_returns_empty_when_advisory_lock_not_acquired(self, mock_conn):
        mock_conn.vendor = "postgresql"
        inner_cursor = MagicMock()
        inner_cursor.execute = MagicMock()
        inner_cursor.fetchone.return_value = (False,)
        cm = MagicMock()
        cm.__enter__.return_value = inner_cursor
        cm.__exit__.return_value = None
        mock_conn.cursor.return_value = cm

        result = run_lazy_simulation(notify_rooms=False)
        self.assertEqual(result, [])
        inner_cursor.execute.assert_called()


class CommandViewDeadlockRetryTests(TestCase):
    def setUp(self):
        self.room = _room("deadlock-cmd")
        self.cc = CharacterClass.objects.create(slug="war-dl", name="Warrior", sort_order=0)

    def test_retries_sim_path_on_deadlock(self):
        u = _approved_user("deadlock-cmd@example.com")
        Character.objects.create(
            user=u,
            name="HeroDL",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        client = APIClient()
        client.force_login(u)

        calls: list[int] = []

        def side_effect(*args, **kwargs):
            calls.append(1)
            if len(calls) == 1:
                raise OperationalError("deadlock detected")
            return []

        with patch("qff.views.run_lazy_simulation", side_effect=side_effect):
            res = client.post("/api/v1/qff/command/", {"line": "look"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(calls), 2)
        body = res.json()
        self.assertIn("session", body)
        self.assertTrue(body["session"]["has_character"])
