from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import Area, Character, CharacterClass, Item, ItemInstance, Room
from qff.session_payload import build_session_for_character

User = get_user_model()


class FloorPickupAndLabelsTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(name="FPL", slug="fpl-area", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=self.area, name="R", slug="fpl-room")
        self.cc = CharacterClass.objects.create(slug="war-fpl", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="fpl@example.com", password="secret12345")
        self.hero = Character.objects.create(
            user=user,
            name="Hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_get_from_floor_stack_takes_one_by_default(self):
        it = Item.objects.create(
            slug="fpl-stack",
            name="StackThing",
            slot=None,
            stackable=True,
            max_stack=99,
        )
        floor = ItemInstance.objects.create(
            item=it,
            owner_character=None,
            room=self.room,
            quantity=3,
        )
        lines = list(execute_command(self.hero, parse_command("get stackthing")))
        self.assertTrue(any("pick up" in ln.lower() for ln in lines), lines)

        floor.refresh_from_db()
        self.assertEqual(floor.quantity, 2)

        self.hero.refresh_from_db()
        session = build_session_for_character(self.hero, world_sync=False)
        inv_qtys = session["character_profile"]["inventoryQuantities"]
        self.assertIn(1, inv_qtys)

    def test_room_floor_labels_show_stacks(self):
        it = Item.objects.create(slug="fpl-tail", name="Tail", slot=None)
        ItemInstance.objects.create(item=it, owner_character=None, room=self.room, quantity=1)
        ItemInstance.objects.create(item=it, owner_character=None, room=self.room, quantity=1)

        session = build_session_for_character(self.hero, world_sync=False)
        you_see = session["room"]["youSee"]
        self.assertTrue(any(lbl == "Tail (2)" for lbl in you_see), you_see)

