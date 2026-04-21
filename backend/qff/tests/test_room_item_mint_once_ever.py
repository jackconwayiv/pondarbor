"""RoomItem mint_policy once_ever: slot stays hidden after consume."""

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
    Room,
    RoomExit,
    RoomItem,
    RoomItemCharacterClaim,
)
from qff.session_payload import build_session_for_character

User = get_user_model()


class RoomItemMintOnceEverTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="MintEver",
            slug="mint-ever-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="MintRoom", slug="mint-ever-room")
        self.cc = CharacterClass.objects.create(slug="me-class", name="Bard", sort_order=0)
        u = User.objects.create_user(email="me@mint.test", password="secret12345")
        self.char = Character.objects.create(
            user=u,
            name="Once",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=5,
            max_health=10,
        )
        self.potion = Item.objects.create(
            slug="me-potion",
            name="Dew",
            slot=None,
            consumable=True,
            stackable=False,
            extra_data={"consume_effects": [{"kind": "heal_hp", "amount": 1}]},
        )
        self.ri = RoomItem.objects.create(
            room=self.room,
            item=self.potion,
            mint_policy=RoomItem.MintPolicy.ONCE_EVER,
        )

    def _you_see(self) -> list[str]:
        self.char = Character.objects.get(pk=self.char.pk)
        session = build_session_for_character(self.char)
        return session["room"]["youSee"]

    def test_consume_then_slot_still_hidden(self):
        self.assertIn("Dew", self._you_see())
        execute_command(self.char, parse_command("get dew"))
        self.assertNotIn("Dew", self._you_see())
        execute_command(self.char, parse_command("drink dew"))
        lines = execute_command(self.char, parse_command("get dew"))
        self.assertTrue(any("don't see" in ln.lower() for ln in lines), lines)
        self.assertTrue(
            RoomItemCharacterClaim.objects.filter(
                room_item=self.ri, character=self.char
            ).exists()
        )

    def test_drop_in_other_room_slot_still_hidden_once_ever(self):
        r_a, r_b = self.room, Room.objects.create(
            area=self.area, name="MintRoomB", slug="mint-ever-room-b"
        )
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
        execute_command(self.char, parse_command("get dew"))
        execute_command(self.char, parse_command("go north"))
        self.char = Character.objects.get(pk=self.char.pk)
        execute_command(self.char, parse_command("drop dew"))
        execute_command(self.char, parse_command("go south"))
        self.char = Character.objects.get(pk=self.char.pk)
        lines = execute_command(self.char, parse_command("get dew"))
        self.assertTrue(any("don't see" in ln.lower() for ln in lines), lines)
        self.assertTrue(
            RoomItemCharacterClaim.objects.filter(
                room_item=self.ri, character=self.char
            ).exists()
        )
