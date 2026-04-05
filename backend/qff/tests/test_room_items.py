"""Room item slots: mint-on-get, quest visibility, floor suppression."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Character,
    CharacterClass,
    CharacterQuestProgress,
    Item,
    ItemInstance,
    Quest,
    QuestState,
    Room,
    RoomItem,
)
from qff.session_payload import build_session_for_character

User = get_user_model()


def _room(area_name: str, room_slug: str) -> Room:
    from qff.models import Area

    area = Area.objects.create(
        name=area_name,
        slug=f"area-{area_name}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=room_slug)


class RoomItemTests(TestCase):
    def setUp(self):
        self.room = _room("RI", "ri-room")
        self.cc = CharacterClass.objects.create(slug="war-ri", name="Warrior", sort_order=0)
        self.item = Item.objects.create(slug="brass-key-ri", name="Brass Key", slot=None)

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

    def _you_see(self, char: Character) -> list[str]:
        char = Character.objects.get(pk=char.pk)
        session = build_session_for_character(char)
        return session["room"]["youSee"]

    def test_you_see_only_in_matching_quest_state(self):
        quest = Quest.objects.create(slug="q-ri", name="Q")
        st_need = QuestState.objects.create(
            quest=quest, slug="need", name="Need", is_initial=True, sort_order=0
        )
        st_other = QuestState.objects.create(
            quest=quest, slug="other", name="Other", sort_order=1
        )
        RoomItem.objects.create(
            room=self.room,
            item=self.item,
            visible_quest_state=st_need,
        )
        c_wrong = self._char("Wrong")
        CharacterQuestProgress.objects.create(
            character=c_wrong, quest=quest, current_state=st_other
        )
        self.assertNotIn("Brass Key", self._you_see(c_wrong))

        c_ok = self._char("Ok")
        CharacterQuestProgress.objects.create(
            character=c_ok, quest=quest, current_state=st_need
        )
        self.assertIn("Brass Key", self._you_see(c_ok))

    def test_hidden_when_carrying_template(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        c = self._char("Carry")
        inst = ItemInstance.objects.create(item=self.item, owner_character=c, room=None)
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory"])
        self.assertNotIn("Brass Key", self._you_see(c))

    def test_get_mints_instance_room_row_unchanged(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        c = self._char("Taker")
        n_room_items = RoomItem.objects.filter(room=self.room).count()
        lines = execute_command(c, parse_command("get brass"))
        self.assertEqual(RoomItem.objects.filter(room=self.room).count(), n_room_items)
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        inst = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(inst.item_id, self.item.id)
        self.assertTrue(lines[0].lower().startswith("you pick up"))

    def test_second_character_sees_slot_after_first_takes(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        c1 = self._char("First")
        c2 = self._char("Second")
        execute_command(c1, parse_command("get brass"))
        c1 = Character.objects.get(pk=c1.pk)
        self.assertNotIn("Brass Key", self._you_see(c1))
        self.assertIn("Brass Key", self._you_see(c2))

    def test_unowned_floor_suppresses_room_slot(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        ItemInstance.objects.create(
            item=self.item,
            room=self.room,
            owner_character=None,
            floor_dropped_at=timezone.now(),
        )
        c = self._char("See")
        labels = self._you_see(c)
        # Floor instance still appears once; room slot must not add a second label.
        self.assertEqual(labels.count("Brass Key"), 1, labels)

    def test_look_at_room_item_uses_template(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        self.item.description = "A heavy key."
        self.item.save(update_fields=["description"])
        c = self._char("Looker")
        lines = execute_command(c, parse_command("look at brass"))
        self.assertIn("heavy key", lines[0].lower())
