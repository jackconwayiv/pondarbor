"""take … against interactable, NPC, or other hero gives specific lines."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_parser import parse_command
from qff.command_handlers import execute_command
from qff.models import Area, Character, CharacterClass, Interactable, Npc, Room

User = get_user_model()


class TakeTargetMessageTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="T",
            slug="t-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="R", slug="t-room")
        self.cc = CharacterClass.objects.create(slug="w-t", name="War", sort_order=0)
        u = User.objects.create_user(email="h@e.com", password="x")
        u.account_status = User.AccountStatus.APPROVED
        u.save()
        self.hero = Character.objects.create(
            user=u,
            name="Alice",
            name_normalized="alice",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        u2 = User.objects.create_user(email="b@e.com", password="x")
        u2.account_status = User.AccountStatus.APPROVED
        u2.save()
        self.other = Character.objects.create(
            user=u2,
            name="Bob",
            name_normalized="bob",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )

    def test_take_interactable_name(self):
        Interactable.objects.create(
            room=self.room, name="Old Crate", slug="old-crate", kind=Interactable.Kind.OTHER
        )
        lines = execute_command(self.hero, parse_command("take crate"), world_sync=False)
        self.assertEqual(lines, ["You can't take Old Crate."])

    def test_take_npc_name(self):
        Npc.objects.create(room=self.room, name="Tyrol", slug="tyrol")
        lines = execute_command(self.hero, parse_command("take tyrol"), world_sync=False)
        self.assertEqual(lines, ["Tyrol is flattered but unable to join you."])

    def test_take_other_hero_name(self):
        lines = execute_command(self.hero, parse_command("take bob"), world_sync=False)
        self.assertEqual(lines, ["Bob is flattered but unable to join you."])
