from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.game_helpers import encumbrance_excess
from qff.models import (
    Area,
    Character,
    CharacterClass,
    CharacterQuestProgress,
    Item,
    ItemInstance,
    Quest,
    QuestState,
    QuestTransition,
    Room,
)
from qff.quest_engine import apply_transition, character_item_template_quantity

User = get_user_model()


class QuestItemQuantitiesAndEncumbranceTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="QIQ",
            slug="qiq-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="R", slug="qiq-room")
        self.cc = CharacterClass.objects.create(slug="war-qiq", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="qiq@example.com", password="secret12345")
        self.hero = Character.objects.create(
            user=user,
            name="Hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            gains=0,
        )

    def test_encumbrance_counts_inventory_only_not_equipped(self):
        # Cap at gains=0 is 5. Put 5 items in inventory and 1 equipped; should not encumber.
        items = [
            Item.objects.create(slug=f"enc-i{i}", name=f"I{i}", slot=None) for i in range(6)
        ]
        inv_instances = [
            ItemInstance.objects.create(item=items[i], owner_character=self.hero, room=None, quantity=1)
            for i in range(5)
        ]
        self.hero.inventory = [inst.pk for inst in inv_instances]
        self.hero.save(update_fields=["inventory"])
        equipped = ItemInstance.objects.create(item=items[5], owner_character=self.hero, room=None, quantity=1)
        self.hero.ring_item = equipped
        self.hero.save(update_fields=["ring_item", "updated_at"])
        self.hero.refresh_from_db()
        self.assertEqual(encumbrance_excess(self.hero), 0)

        # Add one more inventory instance (now 6 inventory rows) => encumbered by 1.
        extra_item = Item.objects.create(slug="enc-extra", name="Extra", slot=None)
        extra_inst = ItemInstance.objects.create(
            item=extra_item, owner_character=self.hero, room=None, quantity=1
        )
        self.hero.inventory = [extra_inst.pk] + list(self.hero.inventory or [])
        self.hero.save(update_fields=["inventory"])
        self.hero.refresh_from_db()
        self.assertEqual(encumbrance_excess(self.hero), 1)

    def test_character_item_template_quantity_sums_stacks(self):
        it = Item.objects.create(slug="stack-q", name="StackQ", slot=None, stackable=True, max_stack=99)
        a = ItemInstance.objects.create(item=it, owner_character=self.hero, room=None, quantity=2)
        b = ItemInstance.objects.create(item=it, owner_character=self.hero, room=None, quantity=3)
        self.hero.inventory = [a.pk, b.pk]
        self.hero.save(update_fields=["inventory"])
        self.hero.refresh_from_db()
        self.assertEqual(character_item_template_quantity(self.hero, it.pk), 5)

    def test_apply_transition_auto_removes_requires_item_quantity(self):
        quest = Quest.objects.create(slug="q-qty", name="Qty")
        st_a = QuestState.objects.create(quest=quest, slug="a", name="A", is_initial=True, sort_order=0)
        st_b = QuestState.objects.create(quest=quest, slug="b", name="B", sort_order=1)
        req_item = Item.objects.create(
            slug="req-qty", name="Req", slot=None, stackable=True, max_stack=99
        )
        tr = QuestTransition.objects.create(
            quest=quest,
            from_state=st_a,
            to_state=st_b,
            requires_item=req_item,
            requires_item_quantity=3,
        )
        CharacterQuestProgress.objects.create(character=self.hero, quest=quest, current_state=st_a)

        inst = ItemInstance.objects.create(item=req_item, owner_character=self.hero, room=None, quantity=4)
        self.hero.inventory = [inst.pk]
        self.hero.save(update_fields=["inventory"])

        apply_transition(self.hero, tr)
        self.hero.refresh_from_db()
        inst.refresh_from_db()
        self.assertEqual(inst.quantity, 1)

