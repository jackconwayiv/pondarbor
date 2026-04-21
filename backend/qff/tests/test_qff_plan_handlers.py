"""Regression tests for QFF item-verb / container / dark / search plan (handler level)."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.constants import NARRATIVE_TOO_DARK_MESSAGE
from qff.exits import exit_is_visible_to_character
from qff.exploration import FLOOR_ITEM_NEGLECT_DELETE_AT, on_leave_room
from qff.models import (
    Area,
    Character,
    CharacterClass,
    CharacterExitSeen,
    Interactable,
    Item,
    ItemInstance,
    Room,
    RoomExit,
)

User = get_user_model()


def _lit_dark_room():
    area = Area.objects.create(
        name="DarkA",
        slug="dark-a",
        grid_width=2,
        grid_height=1,
        is_dark_minimap=True,
    )
    r = Room.objects.create(area=area, name="Cave", slug="cave-d", is_safe=True)
    Room.objects.create(area=area, name="Other", slug="other-d")
    cc = CharacterClass.objects.create(slug="war-d", name="Warrior", sort_order=0)
    user = User.objects.create_user(email="dark@example.com", password="secret12345")
    char = Character.objects.create(
        user=user,
        name="Hero",
        name_normalized="hero",
        character_class=cc,
        current_room=r,
        spawn_room=r,
        last_activity_at=timezone.now(),
        dark_minimap_lit_room_ids=[r.id],
    )
    return char, r


class PlanHandlerDarkTests(TestCase):
    def test_search_blocked_in_unlit_dark_room(self):
        char, room = _lit_dark_room()
        char.dark_minimap_lit_room_ids = []
        char.save(update_fields=["dark_minimap_lit_room_ids"])
        room.search_text = "Secret"
        room.search_chance = 1
        room.save(update_fields=["search_text", "search_chance"])
        lines = execute_command(char, parse_command("search"))
        self.assertEqual(lines, [NARRATIVE_TOO_DARK_MESSAGE])

    def test_read_interactable_blocked_when_unlit(self):
        char, room = _lit_dark_room()
        char.dark_minimap_lit_room_ids = []
        char.save(update_fields=["dark_minimap_lit_room_ids"])
        Interactable.objects.create(
            room=room,
            slug="slab",
            name="slab",
            kind=Interactable.Kind.READABLE,
            inspect_text="Short",
            read_text="Longer",
        )
        lines = execute_command(char, parse_command("read slab"))
        self.assertEqual(lines, [NARRATIVE_TOO_DARK_MESSAGE])


class PlanHandlerUseReadTests(TestCase):
    def setUp(self):
        area = Area.objects.create(name="U", slug="u-area", grid_width=1, grid_height=1)
        self.room = Room.objects.create(area=area, name="Here", slug="u-here", is_safe=True)
        self.cc = CharacterClass.objects.create(slug="war-u", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="use@example.com", password="secret12345")
        self.char = Character.objects.create(
            user=user,
            name="Hero",
            name_normalized="hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_use_two_consumables_same_query_disambiguates(self):
        p1 = Item.objects.create(
            slug="p1",
            name="Red Potion",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.USE,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        p2 = Item.objects.create(
            slug="p2",
            name="Blue Potion",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.USE,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        i1 = ItemInstance.objects.create(item=p1, owner_character=self.char, room=None, quantity=1)
        i2 = ItemInstance.objects.create(item=p2, owner_character=self.char, room=None, quantity=1)
        self.char.inventory = [i1.pk, i2.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("use potion"))
        self.assertEqual(lines, ["What do you want to use?"])

    def test_read_scroll_in_inventory(self):
        scroll = Item.objects.create(
            slug="scroll-r",
            name="Dusty Scroll",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.READ,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        inst = ItemInstance.objects.create(
            item=scroll, owner_character=self.char, room=None, quantity=1
        )
        self.char.inventory = [inst.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("read scroll"))
        self.assertTrue(any("read" in x.lower() for x in lines), lines)
        self.assertFalse(ItemInstance.objects.filter(pk=inst.pk).exists())

    def test_read_sign_prefers_interactable_over_inventory(self):
        scroll = Item.objects.create(
            slug="scroll-s",
            name="sign",
            slot=None,
            consumable=True,
            consume_verb=Item.ConsumeVerb.READ,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        inst = ItemInstance.objects.create(
            item=scroll, owner_character=self.char, room=None, quantity=1
        )
        self.char.inventory = [inst.pk]
        self.char.save(update_fields=["inventory"])
        Interactable.objects.create(
            room=self.room,
            slug="notice",
            name="sign",
            kind=Interactable.Kind.READABLE,
            inspect_text="Carved wood",
            read_text="Beware the grue.",
        )
        lines = execute_command(self.char, parse_command("read sign"))
        self.assertIn("Beware the grue.", lines)
        self.assertTrue(ItemInstance.objects.filter(pk=inst.pk).exists())

    def test_eat_two_consumables_same_query_disambiguates(self):
        a1 = Item.objects.create(
            slug="eat-a1",
            name="Red Apple",
            slot=None,
            consumable=True,
            consume_verb="",
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        a2 = Item.objects.create(
            slug="eat-a2",
            name="Green Apple",
            slot=None,
            consumable=True,
            consume_verb="",
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        i1 = ItemInstance.objects.create(item=a1, owner_character=self.char, room=None, quantity=1)
        i2 = ItemInstance.objects.create(item=a2, owner_character=self.char, room=None, quantity=1)
        self.char.inventory = [i1.pk, i2.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("eat apple"))
        self.assertEqual(lines, ["What do you want to eat?"])

    def test_drink_two_consumables_same_query_disambiguates(self):
        d1 = Item.objects.create(
            slug="drink-d1",
            name="Berry Juice",
            slot=None,
            consumable=True,
            consume_verb="",
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        d2 = Item.objects.create(
            slug="drink-d2",
            name="Citrus Juice",
            slot=None,
            consumable=True,
            consume_verb="",
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        i1 = ItemInstance.objects.create(item=d1, owner_character=self.char, room=None, quantity=1)
        i2 = ItemInstance.objects.create(item=d2, owner_character=self.char, room=None, quantity=1)
        self.char.inventory = [i1.pk, i2.pk]
        self.char.save(update_fields=["inventory"])
        lines = execute_command(self.char, parse_command("drink juice"))
        self.assertEqual(lines, ["What do you want to drink?"])


class ContainerNeglectTests(TestCase):
    def test_items_inside_container_skip_neglect(self):
        area = Area.objects.create(name="NegC", slug="neg-c", grid_width=1, grid_height=1)
        room = Room.objects.create(area=area, name="R", slug="neg-c-r")
        item = Item.objects.create(slug="gem-c", name="Gem", slot="ring")
        chest = Interactable.objects.create(
            room=room,
            slug="c1",
            name="Chest",
            kind=Interactable.Kind.CONTAINER,
        )
        inst = ItemInstance.objects.create(
            item=item,
            room=room,
            owner_character=None,
            container_interactable=chest,
        )
        ItemInstance.objects.filter(pk=inst.pk).update(
            floor_dropped_at=timezone.now() - timedelta(minutes=6)
        )

        for _ in range(FLOOR_ITEM_NEGLECT_DELETE_AT):
            on_leave_room(room.id)
        self.assertTrue(ItemInstance.objects.filter(pk=inst.pk).exists())


class SearchRevealExitVisibilityTests(TestCase):
    def test_hidden_exit_without_reveal_gates_visible_after_exit_seen(self):
        area = Area.objects.create(name="Sx", slug="sx", grid_width=2, grid_height=1)
        r1 = Room.objects.create(area=area, name="A", slug="sx-a")
        r2 = Room.objects.create(area=area, name="B", slug="sx-b")
        ex = RoomExit.objects.create(
            from_room=r1,
            to_room=r2,
            direction=RoomExit.Direction.E,
            is_hidden=True,
        )
        user = User.objects.create_user(email="sx@example.com", password="secret12345")
        cc = CharacterClass.objects.create(slug="w", name="W", sort_order=0)
        char = Character.objects.create(
            user=user,
            name="H",
            name_normalized="h",
            character_class=cc,
            current_room=r1,
            spawn_room=r1,
            last_activity_at=timezone.now(),
        )
        self.assertFalse(exit_is_visible_to_character(char, ex))
        CharacterExitSeen.objects.create(character=char, room_exit=ex)
        self.assertTrue(exit_is_visible_to_character(char, ex))


class PlanHandlerOpenContainerTests(TestCase):
    def test_open_container_sets_opened_interactable(self):
        area = Area.objects.create(name="OpenA", slug="open-a", grid_width=1, grid_height=1)
        room = Room.objects.create(area=area, name="Vault", slug="open-vault", is_safe=True)
        chest = Interactable.objects.create(
            room=room,
            slug="strongbox",
            name="Iron Strongbox",
            kind=Interactable.Kind.CONTAINER,
            inspect_text="Heavy iron.",
        )
        cc = CharacterClass.objects.create(slug="war-open", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="open@example.com", password="secret12345")
        char = Character.objects.create(
            user=user,
            name="Opener",
            name_normalized="opener",
            character_class=cc,
            current_room=room,
            spawn_room=room,
            last_activity_at=timezone.now(),
        )
        lines = execute_command(char, parse_command("open strongbox"))
        char.refresh_from_db()
        self.assertEqual(char.opened_container_interactable_id, chest.id)
        self.assertTrue(lines)
