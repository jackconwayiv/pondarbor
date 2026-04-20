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
from qff.combat_math import StrikeResult
from qff.constants import COMBAT_ROUND_SECONDS, XP_PER_LEVEL
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    MonsterInstance,
    MonsterTemplate,
    Npc,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
)
from qff.monster_sim import (
    _resolve_hero_strike,
    _resolve_monster_strike,
    award_kill,
    hero_drop_all,
    maybe_spawn_lairs,
    run_lazy_simulation,
    sense_adjacent_monsters,
    try_bind_monster_to_room_heroes,
)
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
            monster_strike_pending=True,
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
        self.assertIsNone(self.monster.pursuit_target_character_id)
        self.assertEqual(self.monster.pursuit_path or [], [])
        self.assertIsNone(self.monster.next_pursuit_at)

    def test_pursuit_stops_when_hero_enters_safe_without_prior_message_if_only_pursuit(self):
        """Pursuit-only monsters (e.g. chase without current engage) still drop chase in safe."""
        self.monster.engaged_character_id = None
        self.monster.pursuit_target_character_id = self.hero.pk
        self.monster.pursuit_path = [self.room_safe.id]
        self.monster.save(
            update_fields=[
                "engaged_character",
                "pursuit_target_character",
                "pursuit_path",
                "updated_at",
            ]
        )
        lines = execute_command(self.hero, parse_command("north"))
        self.assertIn("You feel safer here.", lines)
        self.monster.refresh_from_db()
        self.assertIsNone(self.monster.pursuit_target_character_id)
        self.assertEqual(self.monster.pursuit_path or [], [])

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

    def test_hero_drop_all_guts_can_keep_equipped_weapon(self):
        weapon = Item.objects.create(
            slug="guts-keep-blade",
            name="Guts Blade",
            slot=Item.Slot.MAIN_HAND,
            damage=3,
        )
        inst = ItemInstance.objects.create(
            item=weapon,
            owner_character=self.hero,
            room=None,
        )
        self.hero.main_hand_item = inst
        self.hero.guts = 8  # keep_pct = min(25, 1 + 8//8) = 2
        self.hero.save(
            update_fields=["main_hand_item", "guts", "updated_at"],
        )
        with patch("qff.monster_sim.roll_d100", return_value=1):
            hero_drop_all(self.hero)
        self.hero.refresh_from_db()
        self.assertIsNotNone(self.hero.main_hand_item_id)
        inst.refresh_from_db()
        self.assertEqual(inst.owner_character_id, self.hero.pk)

        with patch("qff.monster_sim.roll_d100", return_value=99):
            hero_drop_all(self.hero)
        self.hero.refresh_from_db()
        self.assertIsNone(self.hero.main_hand_item_id)
        inst.refresh_from_db()
        self.assertIsNone(inst.owner_character_id)
        self.assertEqual(inst.room_id, self.room_danger.id)

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
        self.monster.cur_hp = 80
        self.monster.max_hp = 80
        self.monster.save(update_fields=["cur_hp", "max_hp", "updated_at"])
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ):
            _resolve_hero_strike(self.hero, now)
        self.monster.refresh_from_db()
        self.assertLess(self.monster.cur_hp, 80)
        self.assertGreater(self.monster.cur_hp, 0)
        c = self.monster.xp_contribution or {}
        self.assertEqual(int(c.get(str(self.hero.pk), 0)), 80 - self.monster.cur_hp)

    def test_sense_adjacent_vertical_copy(self):
        below = Room.objects.create(area=self.area, name="Below", slug="below")
        RoomExit.objects.create(
            from_room=self.room_danger,
            to_room=below,
            direction=RoomExit.Direction.DOWN,
        )
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=below,
            cur_hp=5,
            max_hp=5,
        )
        with patch("qff.monster_sim.roll_d100", return_value=50):
            sense_adjacent_monsters(self.hero, self.room_danger.id)
        b = RoomBroadcast.objects.filter(room_id=self.room_danger.id).order_by("-id").first()
        self.assertIsNotNone(b)
        self.assertIn("below you", b.text.lower())

    def test_take_gold_pile(self):
        RoomGoldPile.objects.create(room_id=self.room_danger.id, amount_remaining=12, label="")
        self.hero.gold = 0
        self.hero.save(update_fields=["gold", "updated_at"])
        lines = execute_command(self.hero, parse_command("take gold"))
        self.assertTrue(any("12 gold" in ln.lower() for ln in lines), lines)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.gold, 12)
        self.assertFalse(RoomGoldPile.objects.filter(room_id=self.room_danger.id).exists())

    def test_take_partial_gold_floor(self):
        RoomGoldPile.objects.create(room_id=self.room_danger.id, amount_remaining=12, label="")
        self.hero.gold = 0
        self.hero.save(update_fields=["gold", "updated_at"])
        lines = execute_command(self.hero, parse_command("take 5 gold"))
        self.assertTrue(any("5 gold" in ln.lower() for ln in lines), lines)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.gold, 5)
        left = RoomGoldPile.objects.filter(room_id=self.room_danger.id).first()
        self.assertIsNotNone(left)
        self.assertEqual(int(left.amount_remaining), 7)

    def test_award_kill_xp_by_contribution(self):
        u2 = _test_user("h2@example.com")
        h2 = Character.objects.create(
            user=u2,
            name="H2",
            character_class=self.cc,
            current_room=self.room_danger,
            spawn_room=self.room_danger,
            last_activity_at=timezone.now(),
            xp=0,
        )
        self.monster.xp_contribution = {str(self.hero.pk): 9, str(h2.pk): 1}
        self.monster.save(update_fields=["xp_contribution", "updated_at"])
        self.tpl.xp_value = 100
        self.tpl.save(update_fields=["xp_value", "updated_at"])
        hero_xp_before = int(self.hero.xp)
        now = timezone.now()
        award_kill(self.monster, self.room_danger.id, now)
        self.hero.refresh_from_db()
        h2.refresh_from_db()
        self.assertEqual(self.hero.xp, hero_xp_before + 90)
        self.assertEqual(h2.xp, 10)

    def test_award_kill_loot_first_success(self):
        slug_item = Item.objects.create(slug="loot_a", name="Loot A", slot=None)
        self.tpl.loot_table = [
            {"slug": "loot_a", "qty": 1, "chance": 50},
        ]
        self.tpl.save(update_fields=["loot_table", "updated_at"])
        m2 = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room_danger,
            cur_hp=1,
            max_hp=5,
        )
        now = timezone.now()
        with patch("qff.monster_sim.roll_d100", return_value=50):
            award_kill(m2, self.room_danger.id, now)

        self.assertFalse(MonsterInstance.objects.filter(pk=m2.pk).exists())
        self.assertTrue(
            ItemInstance.objects.filter(room_id=self.room_danger.id, item=slug_item).exists()
        )

    def test_award_kill_loot_table_d100_in_template_order(self):
        """First matching row wins; rows are not reordered by chance percent."""
        it_common = Item.objects.create(slug="loot_ord_c", name="Loot Common", slot=None)
        it_rare = Item.objects.create(slug="loot_ord_r", name="Loot Rare", slot=None)
        self.tpl.loot_table = [
            {"slug": "loot_ord_c", "qty": 1, "chance": 100},
            {"slug": "loot_ord_r", "qty": 1, "chance": 100},
        ]
        self.tpl.save(update_fields=["loot_table", "updated_at"])
        m2 = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room_danger,
            cur_hp=1,
            max_hp=5,
        )
        now = timezone.now()
        with patch("qff.monster_sim.roll_d100", return_value=50):
            award_kill(m2, self.room_danger.id, now)
        self.assertTrue(
            ItemInstance.objects.filter(room_id=self.room_danger.id, item=it_common).exists()
        )
        self.assertFalse(
            ItemInstance.objects.filter(room_id=self.room_danger.id, item=it_rare).exists()
        )

        m3 = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room_danger,
            cur_hp=1,
            max_hp=5,
        )
        self.tpl.loot_table = [
            {"slug": "loot_ord_r", "qty": 1, "chance": 10},
            {"slug": "loot_ord_c", "qty": 1, "chance": 100},
        ]
        self.tpl.save(update_fields=["loot_table", "updated_at"])
        ItemInstance.objects.filter(room_id=self.room_danger.id).delete()
        now = timezone.now()
        with patch("qff.monster_sim.roll_d100", side_effect=[50, 50]):
            award_kill(m3, self.room_danger.id, now)
        self.assertFalse(
            ItemInstance.objects.filter(room_id=self.room_danger.id, item=it_rare).exists()
        )
        self.assertTrue(
            ItemInstance.objects.filter(room_id=self.room_danger.id, item=it_common).exists()
        )

    def test_attack_rat_targets_sewer_rat_name(self):
        self.tpl.name = "Sewer Rat"
        self.tpl.save(update_fields=["name", "updated_at"])
        lines = execute_command(self.hero, parse_command("attack rat"))
        self.assertTrue(any("ready" in ln.lower() for ln in lines), lines)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.combat_target_monster_id, self.monster.pk)

    def test_lair_spawn_engages_hero_in_room(self):
        lair = Room.objects.create(area=self.area, name="Lair", slug="lair-eng-test")
        lair.monster_lair_template = self.tpl
        lair.save(update_fields=["monster_lair_template", "updated_at"])
        self.hero.current_room = lair
        self.hero.save(update_fields=["current_room", "updated_at"])
        now = timezone.now()
        maybe_spawn_lairs(now)
        m = MonsterInstance.objects.filter(current_room=lair).first()
        self.assertIsNotNone(m)
        self.assertEqual(m.engaged_character_id, self.hero.pk)
        self.assertFalse(m.monster_strike_pending)

    def test_engagement_first_combat_tick_is_wind_up_not_damage(self):
        """Bind leaves strike pending False; first due flush narrates wind-up, no HP loss."""
        self.monster.engaged_character_id = None
        self.monster.pursuit_target_character_id = None
        self.monster.monster_strike_pending = False
        self.monster.next_action_at = None
        self.monster.save(
            update_fields=[
                "engaged_character",
                "pursuit_target_character",
                "monster_strike_pending",
                "next_action_at",
                "updated_at",
            ]
        )
        now = timezone.now()
        self.assertTrue(
            try_bind_monster_to_room_heroes(
                MonsterInstance.objects.select_related("template").get(pk=self.monster.pk),
                self.room_danger.id,
                now,
            )
        )
        self.monster.refresh_from_db()
        self.assertFalse(self.monster.monster_strike_pending)
        self.assertLessEqual(
            self.monster.next_action_at,
            now + timedelta(seconds=2),
        )
        hp_before = self.hero.cur_health
        run_lazy_simulation(now + timedelta(seconds=COMBAT_ROUND_SECONDS + 1))
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.cur_health, hp_before)
        b = (
            RoomBroadcast.objects.filter(
                room_id=self.room_danger.id, target_character_id=self.hero.pk
            )
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(b)
        self.assertIn("prepare", b.text.lower())
        self.assertNotIn("strike you for", b.text.lower())

    def test_spoiling_strike_engages_hero(self):
        self.monster.engaged_character_id = None
        self.monster.pursuit_target_character_id = None
        self.monster.monster_strike_pending = True
        self.monster.next_action_at = timezone.now()
        self.monster.save(
            update_fields=[
                "engaged_character",
                "pursuit_target_character",
                "monster_strike_pending",
                "next_action_at",
                "updated_at",
            ]
        )
        now = timezone.now()
        _resolve_monster_strike(self.monster, now)
        self.monster.refresh_from_db()
        self.assertEqual(self.monster.engaged_character_id, self.hero.pk)

    def test_monster_killing_hero_retargets_other(self):
        u2 = _test_user("surv@example.com")
        surv = Character.objects.create(
            user=u2,
            name="Survivor",
            character_class=self.cc,
            current_room=self.room_danger,
            spawn_room=self.room_danger,
            last_activity_at=timezone.now(),
            cur_health=50,
            max_health=50,
        )
        self.tpl.damage_min = 50
        self.tpl.damage_max = 50
        self.tpl.save(update_fields=["damage_min", "damage_max", "updated_at"])
        self.hero.cur_health = 1
        self.hero.save(update_fields=["cur_health", "updated_at"])
        self.monster.engaged_character_id = self.hero.pk
        self.monster.save(update_fields=["engaged_character", "updated_at"])
        now = timezone.now()
        with patch("qff.combat_math.roll_d100", return_value=50):
            _resolve_monster_strike(self.monster, now)
        self.hero.refresh_from_db()
        self.assertTrue(self.hero.is_dead)
        m = MonsterInstance.objects.filter(pk=self.monster.pk).first()
        self.assertIsNotNone(m)
        self.assertEqual(m.engaged_character_id, surv.pk)

    def test_roombroadcast_log_tone_hero_hit(self):
        self.hero.last_command_at = None
        self.hero.combat_target_monster_id = self.monster.pk
        self.hero.next_action_at = timezone.now()
        self.hero.save(
            update_fields=[
                "last_command_at",
                "combat_target_monster",
                "next_action_at",
                "updated_at",
            ]
        )
        self.monster.monster_strike_pending = True
        self.monster.engaged_character_id = self.hero.pk
        self.monster.save(
            update_fields=["monster_strike_pending", "engaged_character", "updated_at"]
        )
        fake = StrikeResult(
            outcome="hit",
            damage=2,
            base_damage=2,
            damage_after_mitigation=2,
            was_crit=False,
            hit_chance=50,
            effective_dodge_chance=5,
            crit_chance=0.05,
        )
        with patch("qff.monster_sim.resolve_physical_strike", return_value=fake):
            _resolve_hero_strike(Character.objects.get(pk=self.hero.pk), timezone.now())
        b = RoomBroadcast.objects.filter(
            room_id=self.room_danger.id,
            target_character_id=self.hero.pk,
            log_tone="hero_hit",
        ).first()
        self.assertIsNotNone(b)

    def test_roombroadcast_log_tone_enemy_hit(self):
        fake = StrikeResult(
            outcome="hit",
            damage=1,
            base_damage=1,
            damage_after_mitigation=1,
            was_crit=False,
            hit_chance=50,
            effective_dodge_chance=5,
            crit_chance=0.05,
        )
        self.monster.monster_strike_pending = True
        self.monster.engaged_character_id = self.hero.pk
        self.monster.save(
            update_fields=["monster_strike_pending", "engaged_character", "updated_at"]
        )
        with patch("qff.monster_sim.resolve_physical_strike", return_value=fake):
            _resolve_monster_strike(
                MonsterInstance.objects.select_related("template").get(pk=self.monster.pk),
                timezone.now(),
            )
        b = RoomBroadcast.objects.filter(
            room_id=self.room_danger.id,
            target_character_id=self.hero.pk,
            log_tone="enemy_hit",
        ).first()
        self.assertIsNotNone(b)
