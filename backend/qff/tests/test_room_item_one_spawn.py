"""RoomItemSpawn: one mint per hero per slot while the instance still exists anywhere."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    Room,
    RoomExit,
    RoomItem,
    RoomItemSpawn,
)
from qff.session_payload import build_session_for_character

User = get_user_model()


def _two_rooms_with_exit():
    area = Area.objects.create(
        name="SpawnTest",
        slug="area-spawn-test",
        grid_width=2,
        grid_height=1,
    )
    r_a = Room.objects.create(area=area, name="Room A", slug="spawn-a")
    r_b = Room.objects.create(area=area, name="Room B", slug="spawn-b")
    RoomExit.objects.create(
        from_room=r_a,
        to_room=r_b,
        direction=RoomExit.Direction.N,
    )
    RoomExit.objects.create(
        from_room=r_b,
        to_room=r_a,
        direction=RoomExit.Direction.S,
    )
    return r_a, r_b


class RoomItemOneSpawnTests(TestCase):
    def setUp(self):
        self.room_a, self.room_b = _two_rooms_with_exit()
        self.cc = CharacterClass.objects.create(slug="war-spawn", name="Warrior", sort_order=0)
        self.key = Item.objects.create(slug="rust-key-spawn", name="Rust Key", slot=None)
        self.potion = Item.objects.create(
            slug="sip-spawn",
            name="Sip",
            slot=None,
            consumable=True,
            stackable=False,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )

    def _char(self, name: str, room: Room) -> Character:
        u = User.objects.create_user(email=f"{name.lower()}@spawn.test", password="secret12345")
        return Character.objects.create(
            user=u,
            name=name,
            character_class=self.cc,
            current_room=room,
            spawn_room=room,
            last_activity_at=timezone.now(),
            cur_health=5,
            max_health=10,
        )

    def _you_see(self, char: Character) -> list[str]:
        char = Character.objects.get(pk=char.pk)
        session = build_session_for_character(char)
        return session["room"]["youSee"]

    def test_drop_in_other_room_blocks_second_pickup_same_hero(self):
        ri = RoomItem.objects.create(room=self.room_a, item=self.key)
        c = self._char("Walker", self.room_a)
        execute_command(c, parse_command("get rust"))
        self.assertEqual(RoomItemSpawn.objects.filter(room_item=ri, character=c).count(), 1)

        execute_command(c, parse_command("go north"))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.current_room_id, self.room_b.id)
        execute_command(c, parse_command("drop rust"))

        execute_command(c, parse_command("go south"))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.current_room_id, self.room_a.id)

        lines = execute_command(c, parse_command("get rust"))
        self.assertTrue(any("don't see" in ln.lower() for ln in lines), lines)
        self.assertEqual(RoomItemSpawn.objects.filter(room_item=ri, character=c).count(), 1)

    def test_consume_deletes_spawn_so_second_pickup_works(self):
        ri = RoomItem.objects.create(room=self.room_a, item=self.potion)
        c = self._char("Drinker", self.room_a)
        execute_command(c, parse_command("get sip"))
        self.assertEqual(RoomItemSpawn.objects.filter(room_item=ri, character=c).count(), 1)

        execute_command(c, parse_command("drink sip"))
        self.assertEqual(RoomItemSpawn.objects.filter(room_item=ri, character=c).count(), 0)

        lines = execute_command(c, parse_command("get sip"))
        self.assertFalse(any("don't see" in ln.lower() for ln in lines), lines)
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(len(c.inventory), 1)
        self.assertEqual(RoomItemSpawn.objects.filter(room_item=ri, character=c).count(), 1)

    def test_allow_repeat_while_carrying_still_allows_second_get(self):
        RoomItem.objects.create(
            room=self.room_a,
            item=self.potion,
            allow_repeat_while_carrying=True,
        )
        c = self._char("Farmer", self.room_a)
        execute_command(c, parse_command("get sip"))
        lines = execute_command(c, parse_command("get sip"))
        self.assertFalse(any("don't see" in ln.lower() for ln in lines), lines)

    def test_other_hero_still_sees_slot_after_first_hero_takes(self):
        RoomItem.objects.create(room=self.room_a, item=self.key)
        c1 = self._char("First", self.room_a)
        c2 = self._char("Second", self.room_a)
        execute_command(c1, parse_command("get rust"))
        self.assertNotIn("Rust Key", self._you_see(c1))
        self.assertIn("Rust Key", self._you_see(c2))

    def test_you_see_hides_slot_for_spawning_hero_after_pickup(self):
        RoomItem.objects.create(room=self.room_a, item=self.key)
        c = self._char("Solo", self.room_a)
        self.assertIn("Rust Key", self._you_see(c))
        execute_command(c, parse_command("get rust"))
        self.assertNotIn("Rust Key", self._you_see(c))
