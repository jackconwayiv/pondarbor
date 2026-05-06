from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.game_helpers import item_meets_requirements
from qff.models import Area, Character, CharacterClass, Item, ItemInstance, Room

User = get_user_model()


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


class ItemGlyphRequirementTests(TestCase):
    def setUp(self):
        self.room = _room("item-glyph")
        self.cc = CharacterClass.objects.create(slug="war-igr", name="Warrior", sort_order=0)
        u = User.objects.create_user(email="hero-igr@example.com", password="secret12345")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        self.hero = Character.objects.create(
            user=u,
            name="HeroIGR",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            glyphs=["⚔️"],
            glyph_levels=[1],
        )

    def test_item_meets_requirements_glyph_matrix(self):
        item_one = Item.objects.create(
            slug="igr-one",
            name="One",
            slot=None,
            required_glyphs=["⚔️"],
            required_glyphs_mode="and",
        )
        item_and = Item.objects.create(
            slug="igr-and",
            name="And",
            slot=None,
            required_glyphs=["⚔️", "🔑"],
            required_glyphs_mode="and",
        )
        item_or = Item.objects.create(
            slug="igr-or",
            name="Or",
            slot=None,
            required_glyphs=["⚔️", "🔑"],
            required_glyphs_mode="or",
        )
        self.assertTrue(item_meets_requirements(self.hero, item_one))
        self.assertFalse(item_meets_requirements(self.hero, item_and))
        self.assertTrue(item_meets_requirements(self.hero, item_or))

    def test_equip_blocks_without_required_glyph(self):
        item = Item.objects.create(
            slug="igr-equip",
            name="Keyblade",
            slot=Item.Slot.MAIN_HAND,
            required_glyphs=["🔑"],
            required_glyphs_mode="and",
        )
        inst = ItemInstance.objects.create(item=item, owner_character=self.hero, room=None)
        self.hero.inventory = [inst.pk]
        self.hero.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(self.hero, parse_command("equip keyblade"))
        self.assertEqual(lines[0], "You aren't skilled enough to use that yet.")

    def test_consume_blocks_without_required_glyph(self):
        potion = Item.objects.create(
            slug="igr-potion",
            name="Potion",
            slot=None,
            consumable=True,
            required_glyphs=["📖"],
            required_glyphs_mode="and",
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 5}]},
        )
        inst = ItemInstance.objects.create(
            item=potion,
            owner_character=self.hero,
            room=None,
            quantity=1,
        )
        self.hero.inventory = [inst.pk]
        self.hero.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(self.hero, parse_command("use potion"))
        self.assertEqual(lines[0], "You aren't skilled enough to use that yet.")


class DmItemGlyphRequirementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="dm-igr@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.client.force_login(self.staff)

    def test_create_item_round_trips_required_glyph_fields(self):
        res = self.client.post(
            "/api/v1/qff/dm/items/",
            {
                "slug": "dm-igr-item",
                "name": "DM IGR Item",
                "required_glyphs": ["⚔️", "🔑"],
                "required_glyphs_mode": "or",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        body = res.json()
        self.assertEqual(body["required_glyphs"], ["⚔️", "🔑"])
        self.assertEqual(body["required_glyphs_mode"], "or")

    def test_create_item_required_glyphs_must_be_list(self):
        res = self.client.post(
            "/api/v1/qff/dm/items/",
            {
                "slug": "dm-igr-item2",
                "name": "DM IGR Item2",
                "required_glyphs": "⚔️",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_glyphs", res.json()["detail"])

    def test_patch_item_rejects_invalid_mode(self):
        item = Item.objects.create(slug="dm-igr-item3", name="DM IGR Item3")
        res = self.client.patch(
            f"/api/v1/qff/dm/items/{item.id}/",
            {"required_glyphs_mode": "xor"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_glyphs_mode", res.json()["detail"])
