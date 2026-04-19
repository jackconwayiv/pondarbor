"""Stacking, consumable extra_data effects, room item allow_repeat."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import ParsedDrop, parse_command
from qff.game_helpers import encumbrance_cap
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    Room,
    RoomItem,
)

User = get_user_model()


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


class StackingAndConsumableTests(TestCase):
    def setUp(self):
        self.room = _room("stack-room")
        self.cc = CharacterClass.objects.create(slug="war-st", name="Warrior", sort_order=0)
        self.potion = Item.objects.create(
            slug="juice-st",
            name="Juice",
            slot=None,
            consumable=True,
            stackable=True,
            max_stack=99,
            extra_data={
                "consume_effects": [
                    {"kind": "heal_hp", "amount": 5},
                    {"kind": "restore_mana", "amount": 3},
                ]
            },
        )

    def _char(self, name: str) -> Character:
        u = User.objects.create_user(email=f"{name.lower()}@example.com", password="secret12345")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        return Character.objects.create(
            user=u,
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=10,
            max_health=20,
            cur_mana=0,
            max_mana=10,
        )

    def test_stack_merges_on_second_room_item_get(self):
        c = self._char("Hero")
        RoomItem.objects.create(
            room=self.room,
            item=self.potion,
            allow_repeat_while_carrying=True,
        )
        execute_command(c, parse_command("get juice"))
        execute_command(c, parse_command("get juice"))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        inst = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(inst.quantity, 2)

    def test_consume_one_from_stack_and_effects(self):
        c = self._char("Hero")
        inst = ItemInstance.objects.create(
            item=self.potion,
            owner_character=c,
            room=None,
            quantity=3,
        )
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("drink juice"))
        c = Character.objects.get(pk=c.pk)
        inst2 = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(inst2.quantity, 2)
        self.assertEqual(c.cur_health, 15)
        self.assertEqual(c.cur_mana, 3)
        self.assertTrue(any("recover 5 health" in x for x in lines))
        self.assertTrue(any("recover 3 mana" in x for x in lines))

    def test_encumbrance_cap_uses_gains_div_10(self):
        c = self._char("T")
        c.gains = 25
        c.save(update_fields=["gains"])
        self.assertEqual(encumbrance_cap(c), 5 + 2)

    def test_parse_drop_leading_quantity(self):
        p = parse_command("drop 3 juice")
        self.assertIsInstance(p, ParsedDrop)
        self.assertEqual(p.quantity, 3)
        self.assertEqual(p.target, "juice")

    def test_drop_partial_quantity_from_stack(self):
        c = self._char("Hero")
        inst = ItemInstance.objects.create(
            item=self.potion,
            owner_character=c,
            room=None,
            quantity=5,
        )
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("drop 2 juice"))
        self.assertTrue(any("x2" in x or "2" in x for x in lines), lines)
        c = Character.objects.get(pk=c.pk)
        kept = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(kept.quantity, 3)
        floor = ItemInstance.objects.filter(
            room_id=self.room.id, owner_character__isnull=True
        ).first()
        self.assertIsNotNone(floor)
        self.assertEqual(floor.quantity, 2)

    def test_drop_quantity_exceeds_stack(self):
        c = self._char("Hero")
        inst = ItemInstance.objects.create(
            item=self.potion,
            owner_character=c,
            room=None,
            quantity=2,
        )
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("drop 9 juice"))
        self.assertTrue(any("don't have that many" in x.lower() for x in lines))

    def test_room_item_allow_repeat_while_carrying(self):
        c = self._char("Farm")
        RoomItem.objects.create(
            room=self.room,
            item=self.potion,
            allow_repeat_while_carrying=True,
        )
        execute_command(c, parse_command("get juice"))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        lines = execute_command(c, parse_command("get juice"))
        self.assertFalse(any("don't see" in x.lower() for x in lines))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        inst = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(inst.quantity, 2)
