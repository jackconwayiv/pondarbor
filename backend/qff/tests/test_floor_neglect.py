"""Floor items gain neglect when players leave the room; removed after threshold."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from qff.exploration import FLOOR_ITEM_NEGLECT_DELETE_AT, on_leave_room
from qff.models import Area, Item, ItemInstance, Room


class FloorNeglectTests(TestCase):
    def test_unowned_floor_item_deleted_after_fourth_departure_when_old_enough(self):
        area = Area.objects.create(name="Neg", slug="neg-test", grid_width=1, grid_height=1)
        room = Room.objects.create(area=area, name="Here", slug="here-neg")
        item = Item.objects.create(slug="loot-neg", name="Loot", slot="ring")
        inst = ItemInstance.objects.create(item=item, room=room, owner_character=None)
        ItemInstance.objects.filter(pk=inst.pk).update(
            floor_dropped_at=timezone.now() - timedelta(minutes=6)
        )
        for _ in range(FLOOR_ITEM_NEGLECT_DELETE_AT - 1):
            on_leave_room(room.id)
            self.assertTrue(ItemInstance.objects.filter(pk=inst.pk).exists())
        on_leave_room(room.id)
        self.assertFalse(ItemInstance.objects.filter(pk=inst.pk).exists())

    def test_not_deleted_while_dropped_less_than_five_minutes(self):
        area = Area.objects.create(name="Neg2", slug="neg-test-2", grid_width=1, grid_height=1)
        room = Room.objects.create(area=area, name="Here2", slug="here-neg-2")
        item = Item.objects.create(slug="loot-neg2", name="Loot2", slot="ring")
        inst = ItemInstance.objects.create(item=item, room=room, owner_character=None)
        ItemInstance.objects.filter(pk=inst.pk).update(
            floor_dropped_at=timezone.now() - timedelta(minutes=1)
        )
        for _ in range(20):
            on_leave_room(room.id)
        self.assertTrue(ItemInstance.objects.filter(pk=inst.pk).exists())
