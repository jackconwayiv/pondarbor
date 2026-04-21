"""Attack re-target, weapon verbs, healer dialogue prepend, /leave, /wave."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.combat_math import StrikeResult


def _strike(outcome: str, damage: int) -> StrikeResult:
    return StrikeResult(
        outcome=outcome,
        damage=damage,
        base_damage=damage,
        damage_after_mitigation=damage,
        was_crit=outcome == "crit",
        hit_chance=80,
        effective_dodge_chance=0,
        crit_chance=5.0,
    )
from qff.command_handlers import execute_command
from qff.command_parser import (
    ParsedEmote,
    ParsedLeave,
    parse_command,
)
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
)
from qff.constants import AFK_LOBBY_KICK_MINUTES, COMBAT_ROUND_SECONDS
from qff.monster_sim import (
    _resolve_hero_strike,
    flush_afk_boots,
    flush_pending_leaves,
    run_lazy_simulation,
)
from qff.session_payload import build_session_for_character

User = get_user_model()


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="secret-abcde")
    u.account_status = User.AccountStatus.APPROVED
    u.save(update_fields=["account_status"])
    return u


class AttackCommandTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="A", slug="a", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=self.area, name="R", slug="r")
        self.cc = CharacterClass.objects.create(slug="warr", name="Warrior", sort_order=0)
        self.hero = Character.objects.create(
            user=_approved_user("h-atk@example.com"),
            name="Hera",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=20,
            max_health=20,
        )
        self.tpl = MonsterTemplate.objects.create(
            slug="rat",
            name="rat",
            max_hp=5,
            damage_min=1,
            damage_max=2,
        )
        self.tpl2 = MonsterTemplate.objects.create(
            slug="bat",
            name="bat",
            max_hp=5,
            damage_min=1,
            damage_max=2,
        )
        self.rat = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room,
            cur_hp=5,
        )
        self.bat = MonsterInstance.objects.create(
            template=self.tpl2,
            current_room=self.room,
            cur_hp=5,
        )

    def test_first_attack_sets_target_and_timer_and_says_prepare(self):
        out = execute_command(self.hero, parse_command("attack rat"))
        self.assertIn("You prepare to attack the rat.", out)
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.combat_target_monster_id, self.rat.pk)
        self.assertIsNotNone(self.hero.next_action_at)

    def test_same_target_does_not_reset_timer(self):
        execute_command(self.hero, parse_command("attack rat"))
        self.hero.refresh_from_db()
        original = self.hero.next_action_at
        # Rewind so an actual reset would move forward.
        Character.objects.filter(pk=self.hero.pk).update(
            next_action_at=timezone.now() - timedelta(seconds=1)
        )
        self.hero.refresh_from_db()
        rewound = self.hero.next_action_at
        out = execute_command(self.hero, parse_command("attack rat"))
        self.assertTrue(any("already attacking the rat" in m.lower() for m in out))
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.next_action_at, rewound)
        self.assertNotEqual(self.hero.next_action_at, original)

    def test_switching_target_resets_timer(self):
        execute_command(self.hero, parse_command("attack rat"))
        self.hero.refresh_from_db()
        Character.objects.filter(pk=self.hero.pk).update(
            next_action_at=timezone.now() - timedelta(seconds=5)
        )
        out = execute_command(self.hero, parse_command("attack bat"))
        self.assertTrue(any("prepare to attack the bat" in m.lower() for m in out))
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.combat_target_monster_id, self.bat.pk)
        self.assertGreater(
            self.hero.next_action_at,
            timezone.now() + timedelta(seconds=COMBAT_ROUND_SECONDS - 1),
        )


class HeroStrikeStringTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="A", slug="a2", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=self.area, name="R", slug="r-strike")
        self.cc = CharacterClass.objects.create(slug="warr2", name="Warrior", sort_order=0)
        self.hero = Character.objects.create(
            user=_approved_user("h-str@example.com"),
            name="Bren",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=20,
            max_health=20,
        )
        self.tpl = MonsterTemplate.objects.create(
            slug="orc",
            name="orc",
            max_hp=10,
            damage_min=1,
            damage_max=2,
        )
        self.monster = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.room,
            cur_hp=10,
        )

    def _equip(self, element: str, name: str = "Blade") -> None:
        weapon = Item.objects.create(
            slug=f"w-{element or 'bare'}",
            name=name,
            slot=Item.Slot.MAIN_HAND,
            damage=3,
            element=element,
        )
        inst = ItemInstance.objects.create(
            item=weapon, owner_character=self.hero, room=None
        )
        self.hero.main_hand_item = inst
        self.hero.save(update_fields=["main_hand_item", "updated_at"])

    def _arm(self) -> None:
        now = timezone.now()
        self.hero.combat_target_monster_id = self.monster.pk
        self.hero.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
        self.hero.last_command_at = now - timedelta(seconds=COMBAT_ROUND_SECONDS + 1)
        self.hero.save(
            update_fields=[
                "combat_target_monster",
                "next_action_at",
                "last_command_at",
                "updated_at",
            ]
        )

    def test_hit_uses_slashing_verb_and_weapon_name(self):
        self._equip("slashing", name="Shortsword")
        self._arm()
        with patch(
            "qff.monster_sim.resolve_physical_strike",
            return_value=_strike("hit", 4),
        ):
            _resolve_hero_strike(self.hero, timezone.now())
        lines = [rb.text for rb in RoomBroadcast.objects.all()]
        self.assertTrue(any("You slash the orc with your Shortsword for 4 damage!" == l for l in lines))

    def test_hit_falls_back_to_hit_with_fists_when_unarmed(self):
        self._arm()
        with patch(
            "qff.monster_sim.resolve_physical_strike",
            return_value=_strike("hit", 2),
        ):
            _resolve_hero_strike(self.hero, timezone.now())
        lines = [rb.text for rb in RoomBroadcast.objects.all()]
        self.assertTrue(any("You hit the orc with your fists for 2 damage!" == l for l in lines))

    def test_miss_uses_new_string(self):
        self._equip("bludgeoning", name="Mace")
        self._arm()
        with patch(
            "qff.monster_sim.resolve_physical_strike",
            return_value=_strike("miss", 0),
        ):
            _resolve_hero_strike(self.hero, timezone.now())
        lines = [rb.text for rb in RoomBroadcast.objects.all()]
        self.assertTrue(any("Your attack misses the orc." == l for l in lines))

    def test_crit_uses_verb(self):
        self._equip("piercing", name="Spear")
        self._arm()
        with patch(
            "qff.monster_sim.resolve_physical_strike",
            return_value=_strike("crit", 7),
        ):
            _resolve_hero_strike(self.hero, timezone.now())
        lines = [rb.text for rb in RoomBroadcast.objects.all()]
        self.assertTrue(
            any("You critically pierce the orc with your Spear for 7 damage!" == l for l in lines)
        )


class HealerDialoguePrependTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="A", slug="ah", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=self.area, name="R", slug="rh")
        self.cc = CharacterClass.objects.create(slug="warrh", name="Warrior", sort_order=0)
        self.hero = Character.objects.create(
            user=_approved_user("h-heal@example.com"),
            name="Jin",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            gold=20,
            cur_health=3,
            max_health=10,
        )

    def test_healer_says_normal_line_then_offer(self):
        npc = Npc.objects.create(
            room=self.room,
            slug="mira",
            name="Mira",
            description="",
            is_healer=True,
            healing_cost=5,
        )
        npc.dialogues.create(text="Hello, traveler.", priority=0)
        out = execute_command(self.hero, parse_command("talk mira"))
        # Normal dialogue line is first; the healer offer follows.
        self.assertTrue(
            any("hello, traveler" in m.lower() for m in out),
            f"missing normal dialogue in {out}",
        )
        self.assertTrue(any("(y/n)" in m.lower() for m in out), f"missing offer in {out}")
        dialogue_idx = next(i for i, m in enumerate(out) if "hello, traveler" in m.lower())
        offer_idx = next(i for i, m in enumerate(out) if "(y/n)" in m.lower())
        self.assertLess(dialogue_idx, offer_idx)


class LeaveCommandTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="A", slug="al", grid_width=1, grid_height=1)
        self.safe_room = Room.objects.create(
            area=self.area, name="Safe", slug="rl-safe", is_safe=True
        )
        self.unsafe_room = Room.objects.create(area=self.area, name="Danger", slug="rl-danger")
        self.cc = CharacterClass.objects.create(slug="warrl", name="Warrior", sort_order=0)
        self.tpl = MonsterTemplate.objects.create(
            slug="goblin",
            name="goblin",
            max_hp=5,
            damage_min=1,
            damage_max=1,
        )

    def _hero(self, name: str, room: Room) -> Character:
        return Character.objects.create(
            user=_approved_user(f"{name}-leave@example.com"),
            name=name,
            character_class=self.cc,
            current_room=room,
            spawn_room=room,
            last_activity_at=timezone.now(),
            cur_health=10,
            max_health=10,
        )

    def test_leave_in_safe_room_is_immediate(self):
        hero = self._hero("Ash", self.safe_room)
        out = execute_command(hero, ParsedLeave())
        hero.refresh_from_db()
        self.assertFalse(hero.is_in_realm)
        self.assertIsNone(hero.pending_leave_at)
        self.assertTrue(any("return to the lobby" in m.lower() for m in out))

    def test_leave_unsafe_no_aggro_is_immediate(self):
        # No monsters in the unsafe room → leave immediately even without is_safe.
        hero = self._hero("Bo", self.unsafe_room)
        out = execute_command(hero, ParsedLeave())
        hero.refresh_from_db()
        self.assertFalse(hero.is_in_realm)
        self.assertTrue(any("return to the lobby" in m.lower() for m in out))

    def test_leave_with_aggro_queues_delay(self):
        hero = self._hero("Cy", self.unsafe_room)
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.unsafe_room,
            cur_hp=5,
            engaged_character=hero,
        )
        out = execute_command(hero, ParsedLeave())
        hero.refresh_from_db()
        self.assertTrue(hero.is_in_realm)
        self.assertIsNotNone(hero.pending_leave_at)
        self.assertTrue(any("stay alive" in m.lower() for m in out))

    def test_pending_leave_completes_in_sim(self):
        hero = self._hero("Dex", self.unsafe_room)
        mon = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.unsafe_room,
            cur_hp=5,
            engaged_character=hero,
        )
        execute_command(hero, ParsedLeave())
        hero.refresh_from_db()
        # Advance pending_leave_at into the past.
        Character.objects.filter(pk=hero.pk).update(
            pending_leave_at=timezone.now() - timedelta(seconds=1)
        )
        flush_pending_leaves(timezone.now())
        hero.refresh_from_db()
        mon.refresh_from_db()
        self.assertFalse(hero.is_in_realm)
        self.assertIsNone(hero.pending_leave_at)
        self.assertIsNone(mon.engaged_character_id)

    def test_non_leave_command_cancels_pending(self):
        hero = self._hero("Eli", self.unsafe_room)
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.unsafe_room,
            cur_hp=5,
            engaged_character=hero,
        )
        execute_command(hero, ParsedLeave())
        hero.refresh_from_db()
        self.assertIsNotNone(hero.pending_leave_at)
        out = execute_command(hero, parse_command("look"))
        hero.refresh_from_db()
        self.assertIsNone(hero.pending_leave_at)
        self.assertTrue(any("abort your escape" in m.lower() for m in out))

    def test_out_of_realm_not_visible_to_peers(self):
        a = self._hero("Ari", self.safe_room)
        b = self._hero("Ben", self.safe_room)
        execute_command(a, ParsedLeave())
        # Ben's session should no longer list Ari.
        sess = build_session_for_character(b)
        names = [o["name"] for o in sess["others_here"]]
        self.assertNotIn("Ari", names)

    def test_parser_treats_leave_exit_quit_as_leave(self):
        for verb in ("leave", "exit", "quit", "/leave", "/exit", "/quit"):
            self.assertIsInstance(parse_command(verb), ParsedLeave, msg=verb)

    def test_afk_boot_completes_via_sim(self):
        hero = self._hero("Fia", self.unsafe_room)
        mon = MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.unsafe_room,
            cur_hp=5,
            engaged_character=hero,
        )
        Character.objects.filter(pk=hero.pk).update(
            last_activity_at=timezone.now()
            - timedelta(minutes=AFK_LOBBY_KICK_MINUTES + 1)
        )
        flush_afk_boots(timezone.now())
        hero.refresh_from_db()
        mon.refresh_from_db()
        self.assertFalse(hero.is_in_realm)
        self.assertIsNone(mon.engaged_character_id)

    def test_afk_boot_eager_in_session_payload(self):
        hero = self._hero("Gus", self.unsafe_room)
        MonsterInstance.objects.create(
            template=self.tpl,
            current_room=self.unsafe_room,
            cur_hp=5,
            engaged_character=hero,
        )
        Character.objects.filter(pk=hero.pk).update(
            last_activity_at=timezone.now()
            - timedelta(minutes=AFK_LOBBY_KICK_MINUTES + 1)
        )
        hero.refresh_from_db()
        sess = build_session_for_character(hero)
        self.assertTrue(sess["force_lobby"])
        hero.refresh_from_db()
        self.assertFalse(hero.is_in_realm)


class WaveEmoteTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="A", slug="aw", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=self.area, name="R", slug="rw")
        self.cc = CharacterClass.objects.create(slug="warrw", name="Warrior", sort_order=0)

    def _hero(self, name: str) -> Character:
        return Character.objects.create(
            user=_approved_user(f"{name}-wave@example.com"),
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=10,
            max_health=10,
        )

    def test_parser_parses_wave_variants(self):
        p = parse_command("wave")
        self.assertIsInstance(p, ParsedEmote)
        self.assertEqual(p.verb, "wave")
        self.assertEqual(p.target, "")
        for form in ("wave Bob", "wave at Bob", "/wave Bob", "/wave at Bob"):
            p = parse_command(form)
            self.assertIsInstance(p, ParsedEmote, msg=form)
            self.assertEqual(p.verb, "wave", msg=form)
            self.assertEqual(p.target.lower(), "bob", msg=form)

    def test_bare_wave_actor_and_peer_lines(self):
        a = self._hero("Ava")
        self._hero("Ben")  # so peers count > 0
        out = execute_command(a, parse_command("wave"))
        self.assertEqual(out, ["You wave at the room."])
        peers = [rb.text for rb in RoomBroadcast.objects.filter(room=self.room)]
        self.assertIn("Ava waves.", peers)

    def test_targeted_wave_broadcasts(self):
        a = self._hero("Ava")
        b = self._hero("Ben")
        c = self._hero("Cor")
        out = execute_command(a, parse_command("wave ben"))
        self.assertEqual(out, ["You wave at Ben."])
        texts = {
            (rb.target_character_id, rb.text)
            for rb in RoomBroadcast.objects.filter(room=self.room)
        }
        self.assertIn((b.pk, "Ava waves at you."), texts)
        self.assertIn((c.pk, "Ava waves at Ben."), texts)

    def test_unknown_target_falls_back_to_untargeted(self):
        a = self._hero("Ava")
        self._hero("Ben")
        out = execute_command(a, parse_command("wave phantom"))
        self.assertEqual(out, ["You wave at the room."])
        peers = [rb.text for rb in RoomBroadcast.objects.filter(room=self.room)]
        self.assertIn("Ava waves.", peers)

    def test_self_wave(self):
        a = self._hero("Ava")
        self._hero("Ben")
        out = execute_command(a, parse_command("wave ava"))
        self.assertEqual(out, ["You wave at yourself."])
        peers = [rb.text for rb in RoomBroadcast.objects.filter(room=self.room)]
        self.assertEqual(peers, [])
