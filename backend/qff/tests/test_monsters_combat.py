"""Monsters, pursuit hooks, combat pacing, training, and session broadcast targeting."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Max
from django.test import TestCase
from django.utils import timezone

User = get_user_model()


def _test_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.save(update_fields=["account_status"])
    return u

from qff.command_handlers import execute_command
from qff.command_parser import ParsedAttack, ParsedTrain, parse_command
from qff.constants import COMBAT_ROUND_SECONDS, XP_PER_LEVEL
from qff.models import (
    Area,
    Character,
    CharacterClass,
    MonsterInstance,
    MonsterTemplate,
    Npc,
    Room,
    RoomBroadcast,
    RoomExit,
)
from qff.monster_sim import _resolve_hero_strike, run_lazy_simulation
from qff.session_payload import build_session_for_character, consume_room_broadcasts


class MonsterCombatTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="MArea",
            slug="marea",
            grid_width=2,
            grid_height=1,
        )
        self.room_danger = Room.objects.create(
            area=self.area,
            name="Danger",
            slug="danger",
        )
        self.room_safe = Room.objects.create(
            area=self.area,
            name="Safe",
            slug="safe",
            is_safe=True,
        )
        RoomExit.objects.create(
            from_room=self.room_danger,
            to_room=self.room_safe,
            direction=RoomExit.Direction.N,
        )
        RoomExit.objects.create(
            from_room=self.room_safe,
            to_room=self.room_danger,
            direction=RoomExit.Direction.S,
        )
        self.cc = CharacterClass.objects.create(slug="war-m", name="Warrior", sort_order=0)
        self.hero_user = _test_user("hero-mc@example.com")
        self.hero = Character.objects.create(
            user=self.hero_user,
            name="Hero",
            character_class=self.cc,
            current_room=self.room_danger,
            spawn_room=self.room_danger,
            last_activity_at=timezone.now(),
            cur_health=50,
            max_health=50,
            xp=XP_PER_LEVEL,
            level=1,
        )
        self.tpl = MonsterTemplate.objects.create(
            slug="test_rat",
            name="Test Rat",
            max_hp=5,
            damage_min=1,
            damage_max=2,
            moves=0,
            xp_value=5,
            gold_min=0,
            gold_max=0,
        )
        self.monster = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room_danger,
            cur_hp=5,
            max_hp=5,
            engaged_character=self.hero,
            pursuit_target_character=self.hero,
        )

    def test_attack_sets_timer_and_target(self):
        lines = execute_command(self.hero, parse_command("attack test rat"))
        self.assertIn("You ready an attack.", lines)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.combat_target_monster_id, self.monster.pk)
        self.assertIsNotNone(self.hero.next_action_at)

    def test_attack_parsed_variants(self):
        self.assertIsInstance(parse_command("/attack test rat"), ParsedAttack)
        self.assertIsInstance(parse_command("atk rat"), ParsedAttack)
        self.assertIsInstance(parse_command("train"), ParsedTrain)

    def test_safe_room_disengages_and_message(self):
        self.hero.next_action_at = timezone.now() + timedelta(seconds=COMBAT_ROUND_SECONDS)
        self.hero.save(update_fields=["next_action_at", "updated_at"])
        lines = execute_command(self.hero, parse_command("north"))
        self.assertIn("You feel safer here.", lines)
        self.hero.refresh_from_db()
        self.assertIsNone(self.hero.next_action_at)
        self.assertIsNone(self.hero.combat_target_monster_id)
        self.monster.refresh_from_db()
        self.assertIsNone(self.monster.engaged_character_id)

    def test_pursuit_path_after_move(self):
        lines = execute_command(self.hero, parse_command("north"))
        self.assertIn("You head north.", lines)
        self.monster.refresh_from_db()
        path = [int(x) for x in (self.monster.pursuit_path or [])]
        self.assertIn(self.room_safe.id, path)

    def test_consume_broadcasts_respects_target_character(self):
        other = Character.objects.create(
            user=_test_user("other-mc@example.com"),
            name="Other",
            character_class=self.cc,
            current_room=self.room_danger,
            spawn_room=self.room_danger,
            last_activity_at=timezone.now(),
        )
        max_id = (
            RoomBroadcast.objects.filter(room_id=self.room_danger.id).aggregate(m=Max("id"))[
                "m"
            ]
            or 0
        )
        RoomBroadcast.objects.create(
            room_id=self.room_danger.id,
            speaker_id=None,
            target_character_id=other.pk,
            text="Secret for other only.",
        )
        self.hero.last_room_broadcast_id = max_id
        self.hero.save(update_fields=["last_room_broadcast_id", "updated_at"])
        lines = consume_room_broadcasts(self.hero)
        self.assertEqual(lines, [])
        other.last_room_broadcast_id = max_id
        other.save(update_fields=["last_room_broadcast_id", "updated_at"])
        lines_o = consume_room_broadcasts(other)
        self.assertEqual(lines_o, ["Secret for other only."])

    def test_session_includes_monsters(self):
        session = build_session_for_character(self.hero)
        self.assertEqual(len(session["room"]["monsters"]), 1)
        self.assertEqual(session["room"]["monsters"][0]["slug"], "test_rat")

    def test_train_requires_trainer(self):
        lines = execute_command(self.hero, parse_command("train"))
        self.assertIn("no trainer", lines[0].lower())

    def test_train_with_trainer_and_xp(self):
        Npc.objects.create(
            room=self.room_danger,
            slug="coach",
            name="Coach",
            is_trainer=True,
        )
        lines = execute_command(self.hero, parse_command("train"))
        self.assertTrue(any("level 2" in ln.lower() for ln in lines), lines)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.level, 2)
        self.assertGreaterEqual(self.hero.unspent_stat_points, 3)

    def test_dead_blocks_action(self):
        self.hero.is_dead = True
        self.hero.save(update_fields=["is_dead", "updated_at"])
        lines = execute_command(self.hero, parse_command("north"))
        self.assertIn("dead", lines[0].lower())

    def test_lazy_sim_revives_after_round(self):
        self.hero.is_dead = True
        self.hero.died_at = timezone.now() - timedelta(seconds=COMBAT_ROUND_SECONDS + 1)
        self.hero.current_room_id = self.room_danger.id
        self.hero.spawn_room_id = self.room_safe.id
        self.hero.save(
            update_fields=[
                "is_dead",
                "died_at",
                "current_room",
                "spawn_room",
                "updated_at",
            ]
        )
        run_lazy_simulation(timezone.now())
        self.hero.refresh_from_db()
        self.assertFalse(self.hero.is_dead)
        self.assertEqual(self.hero.current_room_id, self.room_safe.id)

    def test_hero_strike_miss_no_damage(self):
        now = timezone.now()
        self.hero.combat_target_monster_id = self.monster.pk
        self.hero.next_action_at = now
        self.hero.last_command_at = now - timedelta(seconds=30)
        self.hero.save(
            update_fields=[
                "combat_target_monster_id",
                "next_action_at",
                "last_command_at",
                "updated_at",
            ]
        )
        self.monster.cur_hp = 5
        self.monster.save(update_fields=["cur_hp", "updated_at"])
        with patch("qff.combat_math.roll_d100", return_value=100):
            _resolve_hero_strike(self.hero, now)
        self.monster.refresh_from_db()
        self.assertEqual(self.monster.cur_hp, 5)

    def test_hero_strike_hit_reduces_monster_hp(self):
        now = timezone.now()
        self.hero.combat_target_monster_id = self.monster.pk
        self.hero.next_action_at = now
        self.hero.last_command_at = now - timedelta(seconds=30)
        self.hero.save(
            update_fields=[
                "combat_target_monster_id",
                "next_action_at",
                "last_command_at",
                "updated_at",
            ]
        )
        self.monster.cur_hp = 5
        self.monster.save(update_fields=["cur_hp", "updated_at"])
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ):
            _resolve_hero_strike(self.hero, now)
        self.monster.refresh_from_db()
        self.assertLess(self.monster.cur_hp, 5)
        self.assertGreaterEqual(self.monster.cur_hp, 0)
