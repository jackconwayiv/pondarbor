"""Room item slots: mint-on-get, quest visibility, floor suppression."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.constants import AFK_LOBBY_KICK_MINUTES, PRESENCE_MINUTES
from qff.models import (
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
    RoomGoldPile,
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

    def test_you_see_includes_gold_piles(self):
        RoomGoldPile.objects.create(room=self.room, amount_remaining=12, label="")
        RoomGoldPile.objects.create(
            room=self.room, amount_remaining=5, label="Sewer Rat"
        )
        c = self._char("Goldy")
        labels = self._you_see(c)
        self.assertIn("17 gold", labels)
        self.assertEqual(sum(1 for x in labels if "gold" in x.lower()), 1)

    def test_look_at_room_item_uses_template(self):
        RoomItem.objects.create(room=self.room, item=self.item)
        self.item.description = "A heavy key."
        self.item.save(update_fields=["description"])
        c = self._char("Looker")
        lines = execute_command(c, parse_command("look at brass"))
        self.assertIn("heavy key", lines[0].lower())

    def test_look_direction_exit(self):
        east = _room("RIEast", "ri-east")
        east.description = "A long east room description that must not appear on directional look."
        east.save(update_fields=["description", "updated_at"])
        Npc.objects.create(room=east, slug="shop-ri", name="Shopkeeper")
        RoomExit.objects.create(
            from_room=self.room,
            to_room=east,
            direction=RoomExit.Direction.E,
        )
        c = self._char("LookDir")
        lines = execute_command(c, parse_command("look e"))
        self.assertTrue(any("east" in ln.lower() for ln in lines), lines)
        self.assertTrue(any("lies ahead" in ln.lower() for ln in lines), lines)
        self.assertFalse(
            any("long east room description" in ln.lower() for ln in lines), lines
        )
        self.assertTrue(any("make out" in ln.lower() for ln in lines), lines)
        self.assertTrue(any("shopkeeper" in ln.lower() for ln in lines), lines)

    def test_session_afk_and_others_here(self):
        c = self._char("Active")
        c.last_activity_at = timezone.now() - timedelta(minutes=AFK_LOBBY_KICK_MINUTES + 1)
        c.save(update_fields=["last_activity_at", "updated_at"])
        s = build_session_for_character(c)
        self.assertTrue(s["character_profile"]["isInactive"])
        self.assertTrue(s["force_lobby"])
        self.assertEqual(s["others_here"], [])

        peer = self._char("Peer")
        peer.current_room = c.current_room
        peer.last_activity_at = timezone.now() - timedelta(minutes=PRESENCE_MINUTES + 1)
        peer.save(update_fields=["current_room", "last_activity_at", "updated_at"])
        c.last_activity_at = timezone.now()
        c.save(update_fields=["last_activity_at", "updated_at"])
        s2 = build_session_for_character(c)
        self.assertFalse(s2["force_lobby"])
        self.assertEqual(
            s2["others_here"],
            [{"name": "Peer", "inactive": True}],
        )

        peer.last_activity_at = timezone.now() - timedelta(
            minutes=AFK_LOBBY_KICK_MINUTES + 1
        )
        peer.save(update_fields=["last_activity_at", "updated_at"])
        s3 = build_session_for_character(c)
        self.assertEqual(s3["others_here"], [])
