"""Unlocking lore on one instance unlocks the item template for the character."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_parser import parse_command
from qff.command_handlers import execute_command
from qff.game_helpers import character_knows_item_lore_for_template
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


class ItemLoreTemplateUnlockTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="L", slug="l-area", grid_width=1, grid_height=1
        )
        self.room = Room.objects.create(area=self.area, name="LR", slug="l-room")
        self.cc = CharacterClass.objects.create(slug="w-l", name="War", sort_order=0)
        u = User.objects.create_user(email="l@e.com", password="x")
        u.account_status = User.AccountStatus.APPROVED
        u.save()
        self.hero = Character.objects.create(
            user=u,
            name="LoreH",
            name_normalized="loreh",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        self.item = Item.objects.create(
            slug="lore-apple",
            name="Glint Apple",
            lore="Secret blurb.",
            lore_chance=50,
        )
        self.inst1 = ItemInstance.objects.create(
            item=self.item,
            owner_character=self.hero,
            quantity=1,
            unlocked=False,
        )
        self.hero.inventory = [self.inst1.pk]
        self.hero.save()

    @patch("qff.command_handlers.roll_d100_plus_stat_encumbered", return_value=100)
    def test_second_instance_inherits_template_lore(self, _m):
        execute_command(self.hero, parse_command("inspect glint"), world_sync=False)
        self.assertTrue(character_knows_item_lore_for_template(self.hero, self.item))
        inst2 = ItemInstance.objects.create(
            item=self.item, owner_character=self.hero, quantity=1, unlocked=False
        )
        self.hero.inventory = [inst2.pk]
        self.hero.save()
        lines = execute_command(
            self.hero, parse_command("inspect glint"), world_sync=False
        )
        self.assertTrue(any("Secret blurb" in x for x in lines))
        inst2.refresh_from_db()
        self.assertTrue(inst2.unlocked)

    @patch("qff.command_handlers.roll_d100_plus_stat_encumbered", return_value=100)
    def test_inspect_visible_room_item_unlocks_lore_without_inventory(self, _m):
        self.hero.inventory = []
        self.hero.save()
        RoomItem.objects.create(room=self.room, item=self.item)
        lines = execute_command(
            self.hero, parse_command("inspect glint"), world_sync=False
        )
        self.assertTrue(any("Secret blurb" in x for x in lines))
        self.assertTrue(
            character_knows_item_lore_for_template(self.hero, self.item)
        )
