"""Dark minimap, temporary lighting, reset entrances, lamp oil + lantern."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.exploration import on_enter_room
from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    CharacterRoomVisit,
    Item,
    ItemInstance,
    Room,
    RoomExit,
)
from qff.session_payload import build_area_map

User = get_user_model()


class MinimapDarkTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="Cave",
            slug="cave-dark",
            grid_width=5,
            grid_height=5,
            is_dark_minimap=True,
        )
        self.cc = CharacterClass.objects.create(slug="war-cave", name="Warrior", sort_order=0)
        self.rooms: list[Room] = []
        for i in range(25):
            self.rooms.append(
                Room.objects.create(
                    area=self.area,
                    name=f"R{i}",
                    slug=f"cave-r{i}",
                )
            )
        for y in range(5):
            for x in range(5):
                idx = y * 5 + x
                AreaCell.objects.create(area=self.area, x=x, y=y, room=self.rooms[idx])
        for y in range(5):
            for x in range(5):
                idx = y * 5 + x
                room = self.rooms[idx]
                if x < 4:
                    RoomExit.objects.create(
                        from_room=room,
                        to_room=self.rooms[idx + 1],
                        direction=RoomExit.Direction.E,
                    )
                if y < 4:
                    RoomExit.objects.create(
                        from_room=room,
                        to_room=self.rooms[idx + 5],
                        direction=RoomExit.Direction.S,
                    )

        user = User.objects.create_user(email="cave@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.character = Character.objects.create(
            user=user,
            name="Spelunker",
            name_normalized="spelunker",
            character_class=self.cc,
            current_room=self.rooms[12],
            spawn_room=self.rooms[12],
            last_activity_at=timezone.now(),
        )
        self.torch = Item.objects.create(
            slug="torch-t",
            name="Torch",
            slot=None,
            consumable=True,
            stackable=True,
            max_stack=99,
            extra_data={
                "consume_effects": [
                    {"kind": "dark_minimap_light", "radius": 3},
                ]
            },
        )
        self.lantern = Item.objects.create(
            slug="lantern",
            name="Lantern",
            slot=None,
            consumable=False,
            stackable=False,
        )
        self.oil = Item.objects.create(
            slug="lamp-oil-t",
            name="Lamp oil",
            slot=None,
            consumable=True,
            stackable=True,
            max_stack=99,
            extra_data={
                "consume_effects": [
                    {
                        "kind": "dark_minimap_light",
                        "radius": 5,
                        "requires_item_slug": "lantern",
                    },
                ]
            },
        )

    def _visit_all(self):
        for r in self.rooms:
            CharacterRoomVisit.objects.get_or_create(character=self.character, room=r)

    def _fresh_char(self) -> Character:
        return Character.objects.select_related("current_room", "current_room__area").get(
            pk=self.character.pk
        )

    def test_build_area_map_lit_room_ids_dark_area(self):
        self._visit_all()
        c = self._fresh_char()
        m = build_area_map(c)
        g = m["grids"][0]
        self.assertTrue(g["is_dark_minimap"])
        self.assertIn(c.current_room_id, g["lit_room_ids"])

    def test_torch_adds_lit_rooms_in_radius(self):
        self._visit_all()
        c = self._fresh_char()
        inst = ItemInstance.objects.create(item=self.torch, owner_character=c, quantity=1)
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("use torch"))
        self.assertTrue(any("light" in ln.lower() for ln in lines))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.inventory, [])
        self.assertGreater(len(c.dark_minimap_lit_room_ids), 1)
        m = build_area_map(c)
        lit = set(m["grids"][0]["lit_room_ids"])
        self.assertTrue(lit.issuperset(set(c.dark_minimap_lit_room_ids)))

    def test_oil_without_lantern_does_not_consume(self):
        self._visit_all()
        c = self._fresh_char()
        inst = ItemInstance.objects.create(item=self.oil, owner_character=c, quantity=2)
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("use lamp oil"))
        self.assertTrue(any("lantern" in ln.lower() for ln in lines))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        inst2 = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(inst2.quantity, 2)

    def test_oil_with_lantern_consumes_and_lights(self):
        self._visit_all()
        c = self._fresh_char()
        oil_inst = ItemInstance.objects.create(item=self.oil, owner_character=c, quantity=1)
        lantern_inst = ItemInstance.objects.create(
            item=self.lantern, owner_character=c, quantity=1
        )
        c.inventory = [oil_inst.pk, lantern_inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        execute_command(c, parse_command("use lamp oil"))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        rem = ItemInstance.objects.get(pk=c.inventory[0])
        self.assertEqual(rem.item_id, self.lantern.id)

    def test_reset_entrance_clears_temp_lit(self):
        self._visit_all()
        c = self._fresh_char()
        c.dark_minimap_lit_room_ids = [self.rooms[0].id, self.rooms[1].id]
        c.save(update_fields=["dark_minimap_lit_room_ids", "updated_at"])
        mouth = self.rooms[13]
        mouth.reset_dark_lighting_on_enter = True
        mouth.save(update_fields=["reset_dark_lighting_on_enter", "updated_at"])
        on_enter_room(c, mouth.id)
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.dark_minimap_lit_room_ids, [])

    def test_permanent_minimap_light_in_lit_ids_after_reset(self):
        self._visit_all()
        sconce = self.rooms[7]
        sconce.permanent_minimap_light = True
        sconce.save(update_fields=["permanent_minimap_light", "updated_at"])
        c = self._fresh_char()
        c.dark_minimap_lit_room_ids = [self.rooms[0].id]
        c.save(update_fields=["dark_minimap_lit_room_ids", "updated_at"])
        mouth = self.rooms[13]
        mouth.reset_dark_lighting_on_enter = True
        mouth.save(update_fields=["reset_dark_lighting_on_enter", "updated_at"])
        on_enter_room(c, mouth.id)
        c = Character.objects.get(pk=c.pk)
        m = build_area_map(c)
        lit = set(m["grids"][0]["lit_room_ids"])
        self.assertIn(sconce.id, lit)
        self.assertNotIn(self.rooms[0].id, lit)

    def test_torch_in_non_dark_area_rejected(self):
        self.area.is_dark_minimap = False
        self.area.save(update_fields=["is_dark_minimap", "updated_at"])
        self._visit_all()
        c = self._fresh_char()
        inst = ItemInstance.objects.create(item=self.torch, owner_character=c, quantity=1)
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory", "updated_at"])
        lines = execute_command(c, parse_command("use torch"))
        self.assertTrue(any("don't need light" in ln.lower() for ln in lines))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
