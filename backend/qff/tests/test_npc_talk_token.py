"""NPC / interactable name matching: token prefix (e.g. talk mick → Leader Mick)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.models import Area, Character, CharacterClass, Npc, Room
from qff.quest_engine import find_interactable_in_room, find_npc_in_room, name_token_prefix_match
from qff.shop_engine import find_npc_in_room_by_query

User = get_user_model()


class NpcTalkTokenTests(TestCase):
    def setUp(self):
        area = Area.objects.create(
            name="TokArea",
            slug="tok-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=area, name="T", slug="tok-r")
        self.cc = CharacterClass.objects.create(slug="war-tok", name="Warrior", sort_order=0)
        u = User.objects.create_user(email="tok@example.com", password="secret12345")
        self.char = Character.objects.create(
            user=u,
            name="Hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_name_token_prefix_match_helper(self):
        self.assertTrue(name_token_prefix_match("leader mick", "mick"))
        self.assertTrue(name_token_prefix_match("leader mick", "lea"))
        self.assertFalse(name_token_prefix_match("leader mick", "micky"))

    def test_find_npc_in_room_mick(self):
        Npc.objects.create(room=self.room, slug="mick-npc", name="Leader Mick")
        n = find_npc_in_room(self.char, "mick")
        self.assertIsNotNone(n)
        self.assertEqual(n.name, "Leader Mick")

    def test_find_npc_in_room_by_query_shop(self):
        Npc.objects.create(room=self.room, slug="mick-npc", name="Leader Mick")
        n = find_npc_in_room_by_query(self.room.id, "mick")
        self.assertIsNotNone(n)
        self.assertEqual(n.name, "Leader Mick")

    def test_find_interactable_token(self):
        from qff.models import Interactable

        Interactable.objects.create(
            room=self.room,
            slug="rust-lever",
            name="Rusty Lever",
            kind=Interactable.Kind.LEVER,
            inspect_text="A lever.",
        )
        o = find_interactable_in_room(self.char, "lever")
        self.assertIsNotNone(o)
        self.assertEqual(o.name, "Rusty Lever")
