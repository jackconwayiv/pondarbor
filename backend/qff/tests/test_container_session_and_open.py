"""Container contents: not in youSee floor list; open command lists inside in log."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Interactable,
    Item,
    ItemInstance,
    Room,
    RoomItem,
)
from qff.session_payload import build_session_for_character

User = get_user_model()


class ContainerSessionAndOpenTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="CtArea",
            slug="ct-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="CtRoom", slug="ct-room")
        self.cc = CharacterClass.objects.create(slug="ct-class", name="Rogue", sort_order=0)
        u = User.objects.create_user(email="ct@open.test", password="secret12345")
        self.char = Character.objects.create(
            user=u,
            name="Opener",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=5,
            max_health=10,
        )
        self.chest = Interactable.objects.create(
            room=self.room,
            slug="wood-chest",
            name="wooden chest",
            kind=Interactable.Kind.CONTAINER,
            inspect_text="A sturdy chest.",
        )
        self.gem = Item.objects.create(slug="ct-gem", name="Spark Gem", slot=None)
        ItemInstance.objects.create(
            room=self.room,
            item=self.gem,
            quantity=1,
            container_interactable=self.chest,
        )
        self.slot_item = Item.objects.create(slug="ct-slot", name="Slot Prize", slot=None)
        RoomItem.objects.create(room=self.room, item=self.slot_item, interactable=self.chest)
        self.twig = Item.objects.create(slug="ct-twig", name="Twig", slot=None)
        self.twig_inst = ItemInstance.objects.create(
            item=self.twig,
            owner_character=self.char,
            quantity=1,
            room=None,
        )
        self.char.inventory = [self.twig_inst.pk]
        self.char.save(update_fields=["inventory"])

    def test_you_see_excludes_container_interior_instance(self):
        session = build_session_for_character(self.char)
        you_see = session["room"]["youSee"]
        self.assertNotIn("Spark Gem", you_see)

    def test_open_lists_loose_and_slot_labels(self):
        lines = execute_command(self.char, parse_command("open wood"))
        joined = " ".join(lines)
        self.assertIn("You open the wooden chest", joined)
        self.assertIn("Inside:", joined)
        self.assertIn("Spark Gem", joined)
        self.assertIn("Slot Prize", joined)

    def test_put_without_open_says_open_container_first(self):
        lines = execute_command(self.char, parse_command("put twig"))
        self.assertTrue(
            any("open a container first" in ln.lower() for ln in lines),
            lines,
        )

    def test_put_into_open_container(self):
        execute_command(self.char, parse_command("open wood"))
        lines = execute_command(self.char, parse_command("put twig"))
        self.assertTrue(any("you put" in ln.lower() for ln in lines), lines)
        self.twig_inst.refresh_from_db()
        self.assertEqual(self.twig_inst.container_interactable_id, self.chest.pk)
        self.assertEqual(self.twig_inst.room_id, self.room.id)
        self.assertIsNone(self.twig_inst.owner_character_id)
