"""consume_verb gating and teleport_spawn scroll."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import Area, Character, CharacterClass, Item, ItemInstance, Room, RoomExit

User = get_user_model()


def _two_rooms():
    area = Area.objects.create(
        name="CVArea",
        slug="cv-area",
        grid_width=2,
        grid_height=1,
    )
    r_a = Room.objects.create(area=area, name="A", slug="cv-a", is_safe=True)
    r_b = Room.objects.create(area=area, name="B", slug="cv-b", is_spawn_point=True)
    RoomExit.objects.create(from_room=r_a, to_room=r_b, direction=RoomExit.Direction.N)
    RoomExit.objects.create(from_room=r_b, to_room=r_a, direction=RoomExit.Direction.S)
    return r_a, r_b


class ConsumeVerbAndTeleportTests(TestCase):
    def setUp(self):
        self.r_a, self.r_b = _two_rooms()
        self.cc = CharacterClass.objects.create(slug="war-cv", name="Warrior", sort_order=0)
        u = User.objects.create_user(email="cv@example.com", password="secret12345")
        self.char = Character.objects.create(
            user=u,
            name="Hero",
            character_class=self.cc,
            current_room=self.r_a,
            spawn_room=self.r_b,
            last_activity_at=timezone.now(),
            cur_health=20,
            max_health=20,
        )

    def test_consume_verb_eat_blocks_drink(self):
        bread = Item.objects.create(
            slug="bread-cv",
            name="Bread",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.EAT,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        inst = ItemInstance.objects.create(item=bread, owner_character=self.char, room=None, quantity=1)
        self.char.inventory = [inst.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("drink bread"))
        self.assertTrue(any("drink" in x.lower() or "eat" in x.lower() for x in lines), lines)
        self.assertEqual(ItemInstance.objects.filter(pk=inst.pk).count(), 1)

    def test_teleport_scroll_moves_to_spawn(self):
        scroll = Item.objects.create(
            slug="scroll-home",
            name="Scroll",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.USE,
            extra_data={"consume_effects": [{"kind": "teleport_spawn"}]},
        )
        inst = ItemInstance.objects.create(item=scroll, owner_character=self.char, room=None, quantity=1)
        self.char.inventory = [inst.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("use scroll"))
        self.assertTrue(any("whisk" in x.lower() or "spawn" in x.lower() for x in lines), lines)
        c = Character.objects.get(pk=self.char.pk)
        self.assertEqual(c.current_room_id, self.r_b.id)
        self.assertEqual(ItemInstance.objects.filter(pk=inst.pk).count(), 0)
