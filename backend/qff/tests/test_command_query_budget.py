"""Query ceilings for the /qff/command/ hot path.

Originally a single command issued ~80 SQL queries (load character ×2-3, rebuild
session, lazy sim per-flusher, etc.). After the Phase 1/3/4 work in
``qff.session_payload``, ``qff.quest_engine``, ``qff.command_handlers``,
``qff.monster_sim`` and ``qff.views.command_view``, an emote (no monsters / no
inventory / no quest state) should be well under 60 queries on a fresh hero.

The thresholds here are deliberately loose ceilings — they catch large
regressions (e.g. a new N+1) without flapping on every benign refactor.
"""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    Room,
    RoomExit,
)
from qff.monster_sim import run_lazy_simulation
from qff.session_payload import build_session_for_character

User = get_user_model()


class CommandQueryBudgetTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="Budget", slug="budget", grid_width=2, grid_height=1
        )
        self.room = Room.objects.create(area=self.area, name="Hub", slug="budget-hub")
        self.room_east = Room.objects.create(area=self.area, name="East", slug="budget-east")
        self.cc = CharacterClass.objects.create(
            slug="bgt-war", name="Warrior", sort_order=0
        )
        user = User.objects.create_user(
            email="budget@example.com", password="secret-abcde"
        )
        self.hero = Character.objects.create(
            user=user,
            name="Bud",
            name_normalized="bud",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=10,
            max_health=10,
            is_in_realm=True,
        )
        self.move_key = Item.objects.create(slug="move-key", name="Move Key", slot=None)
        move_key_inst = ItemInstance.objects.create(
            item=self.move_key,
            owner_character=self.hero,
            quantity=1,
        )
        self.hero.inventory = [move_key_inst.pk]
        self.hero.save(update_fields=["inventory", "updated_at"])
        RoomExit.objects.create(
            from_room=self.room,
            to_room=self.room_east,
            direction=RoomExit.Direction.E,
            is_hidden=True,
            reveal_item=self.move_key,
            lock_kind=RoomExit.LockKind.KEY,
            key_item=self.move_key,
            consume_key_on_pass=False,
        )

    def _fresh_hero(self) -> Character:
        return Character.objects.select_related(
            "character_class",
            "current_room",
            "current_room__area",
            "spawn_room",
            "head_item__item",
            "main_hand_item__item",
            "off_hand_item__item",
            "chest_item__item",
            "feet_item__item",
            "ring_item__item",
            "amulet_item__item",
        ).get(pk=self.hero.pk)

    def _run_command_path(self, line: str) -> None:
        """Mirror the order in qff.views.command_view minus HTTP/auth/serialization.

        Tracks queries across: ``execute_command`` + ``run_lazy_simulation`` +
        ``build_session_for_character``. This is the cost we actually want to
        bound.
        """
        char = self._fresh_hero()
        execute_command(char, parse_command(line), world_sync=False)
        run_lazy_simulation(notify_rooms=False)
        char_after = self._fresh_hero()
        build_session_for_character(
            char_after, already_synced=True, for_command_response=True
        )

    def test_emote_command_query_budget(self):
        """Emote on a fresh hero: no inventory / monsters / quests in scope.

        The pre-optimisation baseline was ~80 queries. Ceiling = 50 catches a
        regression that re-introduces an N+1 (e.g. per-id ``ItemInstance``
        loads) without flapping on benign refactors.
        """
        with CaptureQueriesContext(connection) as ctx:
            self._run_command_path("smile")
        actual = len(ctx.captured_queries)
        self.assertLessEqual(
            actual, 50, f"emote command exceeded query budget: {actual}"
        )

    def test_look_command_query_budget(self):
        """Look at the room: same shape as emote since the room is empty."""
        with CaptureQueriesContext(connection) as ctx:
            self._run_command_path("look")
        actual = len(ctx.captured_queries)
        self.assertLessEqual(
            actual, 50, f"look command exceeded query budget: {actual}"
        )

    def test_lazy_sim_no_work_due_query_budget(self):
        """``run_lazy_simulation`` with nothing scheduled must short-circuit.

        With the aggregate-MIN watermark in ``_earliest_time_based_lazy_sim_event``
        plus the ``_bind_monsters_has_work`` gate, an idle realm should not run
        any per-flusher loops.
        """
        Character.objects.filter(pk=self.hero.pk).update(
            last_activity_at=timezone.now(),
            next_action_at=None,
            pending_leave_at=None,
            died_at=None,
            is_dead=False,
        )
        with CaptureQueriesContext(connection) as ctx:
            run_lazy_simulation(notify_rooms=False)
        self.assertLessEqual(
            len(ctx.captured_queries),
            12,
            f"idle lazy sim exceeded query budget: {len(ctx.captured_queries)}",
        )

    def test_move_command_query_budget(self):
        """Move through a hidden key-gated exit with a reveal-item requirement."""
        with CaptureQueriesContext(connection) as ctx:
            self._run_command_path("go east")
        actual = len(ctx.captured_queries)
        self.assertLessEqual(
            actual, 75, f"move command exceeded query budget: {actual}"
        )

    def test_full_session_includes_character_profile(self):
        char = self._fresh_hero()
        session = build_session_for_character(char)
        self.assertIn("character_profile", session)

    @override_settings(QFF_COMMAND_SESSION_SLIM_CHARACTER_PROFILE=True)
    def test_partial_move_omits_character_profile_when_slim_enabled(self):
        char = self._fresh_hero()
        session = build_session_for_character(
            char,
            already_synced=True,
            for_command_response=True,
            command_parser_kind="ParsedMove",
        )
        self.assertTrue(session.get("session_partial"))
        self.assertNotIn("character_profile", session)

    @override_settings(QFF_COMMAND_SESSION_SLIM_CHARACTER_PROFILE=True)
    def test_partial_attack_omits_character_profile_when_slim_enabled(self):
        char = self._fresh_hero()
        session = build_session_for_character(
            char,
            already_synced=True,
            for_command_response=True,
            command_parser_kind="ParsedAttack",
        )
        self.assertNotIn("character_profile", session)
