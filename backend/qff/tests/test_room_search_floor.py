"""Room search: floor rewards (once per character; quest-gated while-instance)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
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
