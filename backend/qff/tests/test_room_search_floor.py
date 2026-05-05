"""Room search: floor rewards (once per character; quest-gated while-instance)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.session_payload import build_session_for_character
from qff.models import (
    Area,
    Character,
    CharacterClass,
    CharacterQuestProgress,
    CharacterRoomSearchClaim,
    Item,
    ItemInstance,
    Quest,
    QuestState,
    Room,
)

User = get_user_model()


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="secret12345")
    u.account_status = User.AccountStatus.APPROVED
    u.save(update_fields=["account_status"])
    return u


def _room() -> Room:
    area = Area.objects.create(
        name="SFA",
        slug="sfa-area",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Search room", slug="sfa-room", is_safe=True)


class RoomSearchFloorTests(TestCase):
    def setUp(self):
        self.room = _room()
        self.cc = CharacterClass.objects.create(slug="war-sfa", name="Warrior", sort_order=0)
        self.floor_once_item = Item.objects.create(slug="coin-sfa", name="Lucky Coin", slot=None)
        self.quest_item = Item.objects.create(slug="scroll-sfa", name="Quest Scroll", slot=None)

    def _char(self, name: str) -> Character:
        u = User.objects.create_user(email=f"{name.lower()}@example.com", password="secret12345")
        return Character.objects.create(
            user=u,
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_floor_once_mints_once_per_hero(self):
        self.room.search_text = "You sift through dust."
        self.room.search_chance = 1
        self.room.search_floor_once_item = self.floor_once_item
        self.room.save(
            update_fields=["search_text", "search_chance", "search_floor_once_item", "updated_at"]
        )
        c = self._char("Hero")
        execute_command(c, parse_command("search"))
        claim = CharacterRoomSearchClaim.objects.get(character=c, room=self.room)
        self.assertTrue(claim.floor_once_reward_granted)
        self.assertEqual(
            ItemInstance.objects.filter(
                room=self.room,
                owner_character__isnull=True,
                item=self.floor_once_item,
            ).count(),
            1,
        )
        execute_command(c, parse_command("search"))
        self.assertEqual(
            ItemInstance.objects.filter(
                room=self.room,
                owner_character__isnull=True,
                item=self.floor_once_item,
            ).count(),
            1,
        )

    def test_first_success_then_further_search_yields_nothing(self):
        self.room.search_text = "You sift through dust."
        self.room.search_chance = 1
        self.room.save(update_fields=["search_text", "search_chance", "updated_at"])
        c = self._char("Hero")
        lines1 = list(execute_command(c, parse_command("search")))
        self.assertTrue(any("sift through dust" in ln.lower() for ln in lines1), lines1)
        lines2 = list(execute_command(c, parse_command("search")))
        self.assertEqual(lines2, ["Further searching this room yields nothing of note."])

    def test_success_is_per_hero_not_global(self):
        self.room.search_text = "You sift through dust."
        self.room.search_chance = 1
        self.room.save(update_fields=["search_text", "search_chance", "updated_at"])
        a = self._char("HeroA")
        b = self._char("HeroB")

        self.assertTrue(
            any("sift through dust" in ln.lower() for ln in execute_command(a, parse_command("search"))),
        )
        self.assertEqual(
            execute_command(a, parse_command("search")),
            ["Further searching this room yields nothing of note."],
        )
        self.assertTrue(
            any("sift through dust" in ln.lower() for ln in execute_command(b, parse_command("search"))),
        )

    def test_room_description_appends_search_text_after_success(self):
        self.room.description = "A plain room."
        self.room.search_text = "You sift through dust."
        self.room.search_chance = 1
        self.room.save(
            update_fields=["description", "search_text", "search_chance", "updated_at"]
        )
        c = self._char("Hero")
        execute_command(c, parse_command("search"))
        session = build_session_for_character(c)
        desc = session["room"]["description"]
        self.assertIn("A plain room.", desc)
        self.assertIn("You sift through dust.", desc)

    def test_quest_floor_mints_when_eligible(self):
        quest = Quest.objects.create(slug="q-sfa", name="QF")
        st = QuestState.objects.create(
            quest=quest, slug="need", name="Need", is_initial=True, sort_order=0
        )
        self.room.search_text = "Rummaging."
        self.room.search_chance = 1
        self.room.search_floor_quest_item = self.quest_item
        self.room.search_floor_quest_state = st
        self.room.save(
            update_fields=[
                "search_text",
                "search_chance",
                "search_floor_quest_item",
                "search_floor_quest_state",
                "updated_at",
            ]
        )
        c = self._char("Questor")
        CharacterQuestProgress.objects.create(character=c, quest=quest, current_state=st)
        execute_command(c, parse_command("search"))
        inst = ItemInstance.objects.filter(
            room=self.room,
            owner_character__isnull=True,
            item=self.quest_item,
        ).first()
        self.assertIsNotNone(inst)
        self.assertEqual(inst.visible_quest_state_id, st.id)

    def test_quest_floor_skips_wrong_state(self):
        quest = Quest.objects.create(slug="q-sfa2", name="QF2")
        st_ok = QuestState.objects.create(
            quest=quest, slug="ok", name="Ok", is_initial=True, sort_order=0
        )
        st_wrong = QuestState.objects.create(
            quest=quest, slug="wrong", name="Wrong", sort_order=1
        )
        self.room.search_text = "Rummaging."
        self.room.search_chance = 1
        self.room.search_floor_quest_item = self.quest_item
        self.room.search_floor_quest_state = st_ok
        self.room.save(
            update_fields=[
                "search_text",
                "search_chance",
                "search_floor_quest_item",
                "search_floor_quest_state",
                "updated_at",
            ]
        )
        c = self._char("WrongState")
        CharacterQuestProgress.objects.create(character=c, quest=quest, current_state=st_wrong)
        execute_command(c, parse_command("search"))
        self.assertFalse(
            ItemInstance.objects.filter(
                room=self.room,
                item=self.quest_item,
            ).exists()
        )

    def test_command_api_search_floor_once_returns_200(self):
        """Full POST /qff/command/ path must succeed when search mints a floor item."""
        self.room.search_text = "You sift through dust."
        self.room.search_chance = 1
        self.room.search_floor_once_item = self.floor_once_item
        self.room.save(
            update_fields=[
                "search_text",
                "search_chance",
                "search_floor_once_item",
                "updated_at",
            ]
        )
        u = _approved_user("api-search-floor@example.com")
        Character.objects.create(
            user=u,
            name="ApiHero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "search"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, getattr(res, "data", res.content))
        body = res.json()
        self.assertIsNotNone(body.get("session"))
        msgs = body.get("messages") or []
        self.assertTrue(any("coin" in m.lower() or "uncover" in m.lower() for m in msgs), msgs)
        res2 = client.post("/api/v1/qff/command/", {"line": "search"}, format="json")
        self.assertEqual(
            res2.status_code, status.HTTP_200_OK, getattr(res2, "data", res2.content)
        )
        body2 = res2.json()
        msgs2 = body2.get("messages") or []
        self.assertEqual(msgs2, ["Further searching this room yields nothing of note."])

    def test_command_api_search_quest_floor_returns_200(self):
        """POST /qff/command/ must succeed when search mints a quest-gated floor instance."""
        quest = Quest.objects.create(slug="q-api-sfa", name="QFApi")
        st = QuestState.objects.create(
            quest=quest, slug="need", name="Need", is_initial=True, sort_order=0
        )
        self.room.search_text = "Rummaging."
        self.room.search_chance = 1
        self.room.search_floor_quest_item = self.quest_item
        self.room.search_floor_quest_state = st
        self.room.save(
            update_fields=[
                "search_text",
                "search_chance",
                "search_floor_quest_item",
                "search_floor_quest_state",
                "updated_at",
            ]
        )
        u = _approved_user("api-search-quest@example.com")
        c = Character.objects.create(
            user=u,
            name="ApiQuest",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        CharacterQuestProgress.objects.create(character=c, quest=quest, current_state=st)
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "search"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, getattr(res, "data", res.content))
        body = res.json()
        self.assertIsNotNone(body.get("session"))
        you_see = body["session"]["room"].get("youSee") or []
        self.assertTrue(any("scroll" in s.lower() for s in you_see), you_see)

    def test_command_api_search_reward_inventory_returns_200(self):
        """POST /qff/command/ when search puts an item in inventory (not floor)."""
        reward = Item.objects.create(slug="reward-inv", name="Brass Key", slot=None)
        self.room.search_text = "You check the nook."
        self.room.search_chance = 1
        self.room.search_reward_item = reward
        self.room.save(
            update_fields=[
                "search_text",
                "search_chance",
                "search_reward_item",
                "updated_at",
            ]
        )
        u = _approved_user("api-search-inv@example.com")
        Character.objects.create(
            user=u,
            name="ApiInv",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        client = APIClient()
        client.force_login(u)
        res = client.post("/api/v1/qff/command/", {"line": "search"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, getattr(res, "data", res.content))
        body = res.json()
        prof = body["session"]["character_profile"]
        inv_labels = prof.get("inventoryItems") or []
        self.assertTrue(any("key" in s.lower() for s in inv_labels), inv_labels)
