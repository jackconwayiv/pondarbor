"""Play-path behavior for approved non-staff users (no is_staff; IsApprovedUser)."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Area,
    Character,
    CharacterClass,
    CharacterQuestProgress,
    Item,
    ItemInstance,
    Npc,
    Quest,
    QuestState,
    Room,
    RoomExit,
)
from qff.session_payload import build_session_for_character, consume_room_broadcasts

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


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


class ApprovedNonStaffPlayTests(TestCase):
    """Regression: gameplay must not depend on Django is_staff."""

    def setUp(self):
        self.room = _room("ns-play")
        self.cc = CharacterClass.objects.create(slug="war-ns", name="Warrior", sort_order=0)
        self.item = Item.objects.create(slug="stick-ns", name="Stick", slot=None)

    def _character(self, name: str, user: User) -> Character:
        return Character.objects.create(
            user=user,
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_drop_clears_quest_gate_so_peer_sees_floor_item(self):
        """Quest-gated floor pickup leaves visible_quest_state on instance; drop must clear it."""
        quest = Quest.objects.create(slug="q-ns", name="Q")
        st_need = QuestState.objects.create(
            quest=quest, slug="need", name="Need", is_initial=True, sort_order=0
        )
        ItemInstance.objects.create(
            item=self.item,
            room=self.room,
            owner_character=None,
            visible_quest_state=st_need,
            floor_dropped_at=timezone.now(),
        )
        u1 = _approved_user("picker@example.com")
        c1 = self._character("Picker", u1)
        CharacterQuestProgress.objects.create(
            character=c1, quest=quest, current_state=st_need
        )
        execute_command(c1, parse_command("get stick"))
        c1 = Character.objects.get(pk=c1.pk)
        inst = ItemInstance.objects.get(pk=c1.inventory[0])
        self.assertEqual(inst.visible_quest_state_id, st_need.id)

        execute_command(c1, parse_command("drop stick"))
        inst.refresh_from_db()
        self.assertIsNone(inst.visible_quest_state_id)
        self.assertIsNone(inst.owner_character_id)
        self.assertEqual(inst.room_id, self.room.id)

        u2 = _approved_user("observer@example.com")
        c2 = self._character("Observer", u2)
        c2 = Character.objects.get(pk=c2.pk)
        session = build_session_for_character(c2)
        self.assertIn("Stick", session["room"]["youSee"])

    def test_peer_receives_say_in_action_log(self):
        u1 = _approved_user("alice@example.com")
        u2 = _approved_user("bob@example.com")
        c1 = self._character("Alice", u1)
        c2 = self._character("Bob", u2)
        execute_command(c1, parse_command('say hello'))
        c2 = Character.objects.get(pk=c2.pk)
        lines = consume_room_broadcasts(c2)
        self.assertEqual(len(lines), 1)
        self.assertIn("Alice", lines[0])
        self.assertIn("hello", lines[0])

    def test_session_api_includes_npcs_for_approved_non_staff(self):
        Npc.objects.create(room=self.room, slug="vil", name="Villager")
        u = _approved_user("player@example.com")
        self._character("Hero", u)
        client = APIClient()
        client.force_login(u)
        res = client.get("/api/v1/qff/session/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertTrue(body.get("has_character"))
        npcs = body["room"]["npcs"]
        self.assertEqual(len(npcs), 1)
        self.assertEqual(npcs[0]["name"], "Villager")

    def test_session_get_does_not_touch_last_activity_at(self):
        u = _approved_user("session-presence@example.com")
        c = self._character("SessionHero", u)
        stale = timezone.now() - timedelta(hours=2)
        Character.objects.filter(pk=c.pk).update(last_activity_at=stale)
        client = APIClient()
        client.force_login(u)
        res = client.get("/api/v1/qff/session/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.last_activity_at, stale)

    def test_peer_sees_arrival_line_when_actor_enters_room(self):
        area = Area.objects.create(
            name="NavArea",
            slug="nav-arrival-test",
            grid_width=1,
            grid_height=1,
        )
        room_a = Room.objects.create(area=area, name="A", slug="nav-arrival-a")
        room_b = Room.objects.create(area=area, name="B", slug="nav-arrival-b")
        RoomExit.objects.create(
            from_room=room_a,
            to_room=room_b,
            direction=RoomExit.Direction.N,
        )
        u1 = _approved_user("walker@example.com")
        u2 = _approved_user("watchin@example.com")
        c1 = self._character("Walker", u1)
        c1.current_room = room_a
        c1.save(update_fields=["current_room"])
        c2 = self._character("Watcher", u2)
        c2.current_room = room_b
        c2.save(update_fields=["current_room", "last_activity_at", "updated_at"])
        execute_command(c1, parse_command("north"))
        c2 = Character.objects.get(pk=c2.pk)
        lines = consume_room_broadcasts(c2)
        self.assertTrue(
            any("Walker" in ln and "enters from the south" in ln for ln in lines),
            lines,
        )

    def test_approved_non_staff_can_post_command(self):
        u = _approved_user("cmd@example.com")
        self._character("Hero", u)
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "look"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertIn("session", body)
        self.assertTrue(body["session"]["has_character"])
        self.assertIn("echo_command", body)
        self.assertFalse(body["echo_command"])

    def test_command_echo_true_for_unknown_line(self):
        u = _approved_user("unk@example.com")
        self._character("HeroUnk", u)
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "xyzzy plugh"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.json()["echo_command"])

    def test_session_action_log_entries_have_id_and_text(self):
        u1 = _approved_user("sayer@example.com")
        u2 = _approved_user("hearer@example.com")
        c1 = self._character("Sayer", u1)
        c2 = self._character("Hearer", u2)
        execute_command(c1, parse_command("say hi"))
        c2 = Character.objects.get(pk=c2.pk)
        session = build_session_for_character(c2)
        self.assertEqual(len(session["action_log"]), 1)
        entry = session["action_log"][0]
        self.assertIn("id", entry)
        self.assertIn("text", entry)
        self.assertIsInstance(entry["id"], int)

    def test_peer_sees_third_person_action_lines(self):
        """Observers get RoomBroadcast lines for search, drop, talk (not only `say`)."""
        self.room.search_text = "A loose brick."
        self.room.search_chance = 100
        self.room.save(update_fields=["search_text", "search_chance"])
        Npc.objects.create(room=self.room, slug="vil2", name="Villager")

        u1 = _approved_user("actor@example.com")
        u2 = _approved_user("watch@example.com")
        c1 = self._character("Actor", u1)
        c2 = self._character("Watcher", u2)

        execute_command(c1, parse_command("search"))
        c2 = Character.objects.get(pk=c2.pk)
        lines = consume_room_broadcasts(c2)
        self.assertTrue(any("searching" in ln.lower() for ln in lines))

        inst = ItemInstance.objects.create(item=self.item, owner_character=c1, room=None)
        c1.inventory = [inst.pk]
        c1.save(update_fields=["inventory"])
        c2 = Character.objects.get(pk=c2.pk)
        consume_room_broadcasts(c2)

        execute_command(c1, parse_command("drop stick"))
        c2 = Character.objects.get(pk=c2.pk)
        lines = consume_room_broadcasts(c2)
        self.assertTrue(any("drops" in ln.lower() and "Actor" in ln for ln in lines))

        consume_room_broadcasts(c2)
        execute_command(c1, parse_command("talk to villager"))
        c2 = Character.objects.get(pk=c2.pk)
        lines = consume_room_broadcasts(c2)
        self.assertTrue(any("talking to Villager" in ln for ln in lines))

    def test_session_includes_active_quests_non_terminal_only(self):
        quest = Quest.objects.create(slug="q-actv", name="ActiveQ")
        st_mid = QuestState.objects.create(
            quest=quest,
            slug="mid",
            name="In Progress",
            is_initial=True,
            is_terminal=False,
            sort_order=0,
        )
        st_done = QuestState.objects.create(
            quest=quest, slug="done", name="Done", sort_order=1, is_terminal=True
        )
        u = _approved_user("qact@example.com")
        c = self._character("QHero2", u)
        CharacterQuestProgress.objects.create(
            character=c, quest=quest, current_state=st_mid
        )
        c = Character.objects.get(pk=c.pk)
        session = build_session_for_character(c)
        aq = session.get("active_quests", [])
        self.assertEqual(len(aq), 1)
        self.assertEqual(aq[0]["label"], "In Progress")
        self.assertEqual(aq[0]["slug"], "mid")
        cqp = CharacterQuestProgress.objects.get(character=c, quest=quest)
        cqp.current_state = st_done
        cqp.save(update_fields=["current_state", "updated_at"])
        c = Character.objects.get(pk=c.pk)
        session2 = build_session_for_character(c)
        self.assertEqual(len(session2.get("active_quests", [])), 0)

    def test_npc_says_line_no_period_after_question(self):
        from qff.quest_engine import _npc_says_line

        n = Npc.objects.create(
            room=self.room, slug="rita-q", name="Rita", description=""
        )
        line = _npc_says_line(n, "Can you help?")
        self.assertTrue(line.endswith("?"), line)
        self.assertNotIn("?.", line)
