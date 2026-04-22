"""RoomExit.consume_key_on_pass controls whether the key item is destroyed on use."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.exits import consume_key_if_entering_locked
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    Room,
    RoomExit,
)

User = get_user_model()


class ExitKeyConsumeOnPassTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="K",
            slug="k-area",
            grid_width=2,
            grid_height=1,
        )
        self.a = Room.objects.create(area=self.area, name="A", slug="ka")
        self.b = Room.objects.create(area=self.area, name="B", slug="kb")
        RoomExit.objects.create(
            from_room=self.a,
            to_room=self.b,
            direction=RoomExit.Direction.E,
        )
        self.key = Item.objects.create(slug="rust-key", name="Rust Key")
        self.cc = CharacterClass.objects.create(slug="war-k", name="Warrior", sort_order=0)
        u = User.objects.create_user(email="k@example.com", password="x")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        self.hero = Character.objects.create(
            user=u,
            name="Keybearer",
            name_normalized="keybearer",
            character_class=self.cc,
            current_room=self.a,
            spawn_room=self.a,
            last_activity_at=timezone.now(),
        )

    def test_consume_false_leaves_key_in_inventory(self):
        ex = RoomExit.objects.get(from_room=self.a, direction=RoomExit.Direction.E)
        ex.lock_kind = RoomExit.LockKind.KEY
        ex.key_item = self.key
        ex.consume_key_on_pass = False
        ex.save()
        inst = ItemInstance.objects.create(
            item=self.key,
            owner_character=self.hero,
            quantity=1,
            room=None,
        )
        self.hero.inventory = [inst.pk]
        self.hero.save(update_fields=["inventory", "updated_at"])
        c, _ = consume_key_if_entering_locked(self.hero, ex)
        self.assertFalse(c)
        self.assertTrue(
            ItemInstance.objects.filter(pk=inst.pk, owner_character=self.hero).exists()
        )

    def test_consume_true_removes_stack_of_one(self):
        ex = RoomExit.objects.get(from_room=self.a, direction=RoomExit.Direction.E)
        ex.lock_kind = RoomExit.LockKind.KEY
        ex.key_item = self.key
        ex.consume_key_on_pass = True
        ex.save()
        inst = ItemInstance.objects.create(
            item=self.key,
            owner_character=self.hero,
            quantity=1,
            room=None,
        )
        self.hero.inventory = [inst.pk]
        self.hero.save(update_fields=["inventory", "updated_at"])
        c, kn = consume_key_if_entering_locked(self.hero, ex)
        self.assertTrue(c)
        self.assertEqual(kn, "Rust Key")
        self.assertFalse(ItemInstance.objects.filter(pk=inst.pk).exists())
