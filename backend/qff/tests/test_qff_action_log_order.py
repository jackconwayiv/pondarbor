"""Action log ordering: first-person move lines before monster engagement narration."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.constants import XP_PER_LEVEL
from qff.models import (
    Area,
    Character,
    CharacterClass,
    MonsterInstance,
    MonsterTemplate,
    Room,
    RoomBroadcast,
    RoomExit,
)

User = get_user_model()


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


class ActionLogMoveBeforeEngagementTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="LogOrderArea",
            slug="log-order-area",
            grid_width=2,
            grid_height=1,
        )
        self.room_safe = Room.objects.create(
            area=self.area,
            name="Safe",
            slug="log-safe",
            is_safe=True,
        )
        self.room_danger = Room.objects.create(
            area=self.area,
            name="Danger",
            slug="log-danger",
        )
        RoomExit.objects.create(
            from_room=self.room_safe,
            to_room=self.room_danger,
            direction=RoomExit.Direction.S,
        )
        RoomExit.objects.create(
            from_room=self.room_danger,
            to_room=self.room_safe,
            direction=RoomExit.Direction.N,
        )
        self.cc = CharacterClass.objects.create(slug="war-log", name="Warrior", sort_order=0)
        self.tpl = MonsterTemplate.objects.create(
            slug="log_rat",
            name="Log Rat",
            max_hp=5,
            damage_min=1,
            damage_max=2,
            moves=0,
            xp_value=5,
            gold_min=0,
            gold_max=0,
        )
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room_danger,
            cur_hp=5,
            max_hp=5,
        )

    def test_move_line_precedes_monster_prepares_in_action_log(self):
        u = _approved_user("logorder@example.com")
        Character.objects.create(
            user=u,
            name="Walker",
            character_class=self.cc,
            current_room=self.room_safe,
            spawn_room=self.room_safe,
            last_activity_at=timezone.now(),
            cur_health=50,
            max_health=50,
            xp=XP_PER_LEVEL,
            level=1,
        )
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "south"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        log = res.json()["session"].get("action_log") or []
        texts = [e.get("text", "") for e in log if isinstance(e, dict)]
        move_idx = next(
            (i for i, t in enumerate(texts) if t.startswith("You head ") and "south" in t.lower()),
            None,
        )
        strike_idx = next(
            (i for i, t in enumerate(texts) if "prepares to strike" in t.lower()),
            None,
        )
        self.assertIsNotNone(move_idx, texts)
        self.assertIsNotNone(strike_idx, texts)
        self.assertLess(
            move_idx,
            strike_idx,
            f"expected move before wind-up, got order={texts}",
        )

    def test_sense_line_follows_move_in_action_log(self):
        """Adjacent sense is folded into command messages, so it never precedes ``You head …``."""
        MonsterInstance.objects.filter(current_room=self.room_danger).delete()
        room_east = Room.objects.create(
            area=self.area,
            name="EastLair",
            slug="log-east",
        )
        RoomExit.objects.create(
            from_room=self.room_danger,
            to_room=room_east,
            direction=RoomExit.Direction.E,
        )
        RoomExit.objects.create(
            from_room=room_east,
            to_room=self.room_danger,
            direction=RoomExit.Direction.W,
        )
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=room_east,
            cur_hp=5,
            max_hp=5,
        )
        u = _approved_user("logorder-sense@example.com")
        Character.objects.create(
            user=u,
            name="Sensor",
            character_class=self.cc,
            current_room=self.room_safe,
            spawn_room=self.room_safe,
            last_activity_at=timezone.now(),
            cur_health=50,
            max_health=50,
            xp=XP_PER_LEVEL,
            level=1,
        )
        client = APIClient()
        client.force_login(u)
        with patch("qff.monster_sim.roll_d100", return_value=50):
            res = client.post("/api/v1/qff/command/", {"line": "south"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        log = res.json()["session"].get("action_log") or []
        texts = [e.get("text", "") for e in log if isinstance(e, dict)]
        move_idx = next(
            (i for i, t in enumerate(texts) if t.startswith("You head ") and "south" in t.lower()),
            None,
        )
        sense_idx = next(
            (i for i, t in enumerate(texts) if "sense the presence of an enemy" in t.lower()),
            None,
        )
        self.assertIsNotNone(move_idx, texts)
        self.assertIsNotNone(sense_idx, texts)
        self.assertLess(
            move_idx,
            sense_idx,
            f"expected move before adjacent sense, got order={texts}",
        )

    def test_move_includes_latest_preexisting_room_line(self):
        """Entering a room should retain one line of immediate context."""
        RoomBroadcast.objects.create(
            room=self.room_danger,
            speaker=None,
            text="The Log Rat claws at Walker.",
            scope=RoomBroadcast.Scope.ROOM,
        )
        u = _approved_user("logorder-context@example.com")
        Character.objects.create(
            user=u,
            name="Watcher",
            character_class=self.cc,
            current_room=self.room_safe,
            spawn_room=self.room_safe,
            last_activity_at=timezone.now(),
            cur_health=50,
            max_health=50,
            xp=XP_PER_LEVEL,
            level=1,
        )
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "south"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        log = res.json()["session"].get("action_log") or []
        texts = [e.get("text", "") for e in log if isinstance(e, dict)]
        self.assertTrue(
            any("claws at walker" in t.lower() for t in texts),
            f"expected latest preexisting room line to be preserved, got={texts}",
        )
