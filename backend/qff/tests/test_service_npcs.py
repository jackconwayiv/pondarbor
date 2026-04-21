"""Healer / innkeeper service NPCs: free + paid heals, prompt accept/decline,
rest|sleep alternate trigger, "speak with" synonym, and y/n fall-through."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command, maybe_handle_pending_prompt
from qff.command_parser import (
    ParsedRestSleep,
    ParsedTalk,
    parse_command,
)
from qff.models import Area, Character, CharacterClass, Npc, Room

User = get_user_model()


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


class ServiceNpcTests(TestCase):
    def setUp(self):
        self.room = _room("svc-npcs")
        self.spawn = _room("svc-spawn")
        self.cc = CharacterClass.objects.create(slug="war-svc", name="Warrior", sort_order=0)

    def _char(
        self,
        name: str,
        *,
        gold: int = 0,
        cur_health: int = 4,
        max_health: int = 10,
        cur_mana: int = 0,
        max_mana: int = 10,
        spawn: Room | None = None,
    ) -> Character:
        u = User.objects.create_user(email=f"{name.lower()}@example.com", password="secret12345")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        return Character.objects.create(
            user=u,
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=spawn or self.spawn,
            last_activity_at=timezone.now(),
            gold=gold,
            cur_health=cur_health,
            max_health=max_health,
            cur_mana=cur_mana,
            max_mana=max_mana,
        )

    def _npc(self, **kwargs) -> Npc:
        defaults = dict(room=self.room, slug="svc", name="Sage", description="")
        defaults.update(kwargs)
        return Npc.objects.create(**defaults)

    # --- speak with synonym ----------------------------------------------------

    def test_speak_with_parses_as_talk(self):
        parsed = parse_command("speak with Sage")
        self.assertIsInstance(parsed, ParsedTalk)
        self.assertEqual(parsed.target.lower(), "sage")

    def test_rest_parses_as_rest_sleep(self):
        for verb in ("rest", "sleep", "nap"):
            self.assertIsInstance(parse_command(verb), ParsedRestSleep, msg=verb)

    # --- healer ---------------------------------------------------------------

    def test_free_healer_talk_restores_full_hp(self):
        self._npc(slug="h", name="Mira", is_healer=True, healing_cost=0)
        c = self._char("P1", cur_health=3, max_health=10)
        out = execute_command(c, parse_command("talk mira"))
        self.assertTrue(any("full health" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertEqual(c.cur_health, c.max_health)
        self.assertIsNone(c.pending_prompt)

    def test_paid_healer_offers_prompt_then_accepts(self):
        self._npc(slug="h2", name="Iris", is_healer=True, healing_cost=5)
        c = self._char("P2", gold=20, cur_health=2, max_health=10)
        out = execute_command(c, parse_command("speak with iris"))
        self.assertTrue(any("(y/n)" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertEqual(c.pending_prompt["kind"], "healer_pay")
        self.assertEqual(c.pending_prompt["cost"], 5)
        # Now answer "y" via the same intercept the view uses.
        msgs = maybe_handle_pending_prompt(c, "y")
        self.assertIsNotNone(msgs)
        self.assertTrue(any("pay 5 gold" in m.lower() for m in msgs))
        c.refresh_from_db()
        self.assertEqual(c.gold, 15)
        self.assertEqual(c.cur_health, c.max_health)
        self.assertIsNone(c.pending_prompt)

    def test_paid_healer_decline_clears_prompt_no_charge(self):
        self._npc(slug="h3", name="Tess", is_healer=True, healing_cost=5)
        c = self._char("P3", gold=20, cur_health=2, max_health=10)
        execute_command(c, parse_command("talk tess"))
        c.refresh_from_db()
        self.assertEqual(c.pending_prompt["kind"], "healer_pay")
        msgs = maybe_handle_pending_prompt(c, "n")
        self.assertIsNotNone(msgs)
        c.refresh_from_db()
        self.assertEqual(c.gold, 20)
        self.assertEqual(c.cur_health, 2)
        self.assertIsNone(c.pending_prompt)

    def test_paid_healer_insufficient_gold(self):
        self._npc(slug="h4", name="Lira", is_healer=True, healing_cost=50)
        c = self._char("P4", gold=10, cur_health=2, max_health=10)
        out = execute_command(c, parse_command("talk lira"))
        self.assertTrue(any("can't afford my services" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertIsNone(c.pending_prompt)

    def test_healer_already_full_declines(self):
        self._npc(slug="h5", name="Fia", is_healer=True, healing_cost=5)
        c = self._char("P5", gold=20, cur_health=10, max_health=10)
        out = execute_command(c, parse_command("talk fia"))
        self.assertTrue(any("don't need my services" in m.lower() for m in out))

    # --- innkeeper ------------------------------------------------------------

    def test_free_innkeeper_restores_hp_mana_and_rebinds_spawn(self):
        npc = self._npc(slug="i1", name="Hal", is_innkeeper=True, healing_cost=0)
        c = self._char("P6", cur_health=2, max_health=10, cur_mana=1, max_mana=8)
        original_spawn = c.spawn_room_id
        self.assertNotEqual(original_spawn, npc.room_id)
        out = execute_command(c, parse_command("talk hal"))
        self.assertTrue(any("refuge" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertEqual(c.cur_health, c.max_health)
        self.assertEqual(c.cur_mana, c.max_mana)
        self.assertEqual(c.spawn_room_id, npc.room_id)

    def test_paid_innkeeper_accept_charges_and_binds(self):
        npc = self._npc(slug="i2", name="Eda", is_innkeeper=True, healing_cost=7)
        c = self._char("P7", gold=20, cur_health=2, max_health=10, cur_mana=0, max_mana=6)
        out = execute_command(c, parse_command("talk eda"))
        self.assertTrue(any("(y/n)" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertEqual(c.pending_prompt["kind"], "innkeeper_stay")
        msgs = maybe_handle_pending_prompt(c, "yes")
        self.assertIsNotNone(msgs)
        c.refresh_from_db()
        self.assertEqual(c.gold, 13)
        self.assertEqual(c.cur_health, c.max_health)
        self.assertEqual(c.cur_mana, c.max_mana)
        self.assertEqual(c.spawn_room_id, npc.room_id)

    # --- rest / sleep dispatch ------------------------------------------------

    def test_rest_picks_innkeeper_over_healer(self):
        self._npc(slug="r-h", name="Wren", is_healer=True, healing_cost=0)
        inn = self._npc(slug="r-i", name="Bram", is_innkeeper=True, healing_cost=0)
        c = self._char("P8", cur_health=1, max_health=10, cur_mana=0, max_mana=4)
        out = execute_command(c, parse_command("rest"))
        self.assertTrue(any("refuge" in m.lower() for m in out))
        c.refresh_from_db()
        self.assertEqual(c.spawn_room_id, inn.room_id)
        self.assertEqual(c.cur_mana, c.max_mana)

    def test_sleep_falls_back_to_healer(self):
        self._npc(slug="s-h", name="Sage", is_healer=True, healing_cost=0)
        c = self._char("P9", cur_health=3, max_health=10)
        out = execute_command(c, parse_command("sleep"))
        self.assertTrue(any("full health" in m.lower() for m in out))

    def test_rest_with_no_service_npc(self):
        c = self._char("P10")
        out = execute_command(c, parse_command("rest"))
        self.assertTrue(any("no place to rest" in m.lower() for m in out))

    # --- y/n fall-through -----------------------------------------------------

    def test_pending_prompt_falls_through_on_unrelated_input(self):
        self._npc(slug="h6", name="Tia", is_healer=True, healing_cost=5)
        c = self._char("P11", gold=20, cur_health=2, max_health=10)
        execute_command(c, parse_command("talk tia"))
        c.refresh_from_db()
        self.assertIsNotNone(c.pending_prompt)
        # Non-y/n: prompt cleared, returns None so the caller falls through.
        result = maybe_handle_pending_prompt(c, "look")
        self.assertIsNone(result)
        c.refresh_from_db()
        self.assertIsNone(c.pending_prompt)
