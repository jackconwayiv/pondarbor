"""Sconce and map interactables toggle dark-minimap character state."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.models import Area, AreaCell, Character, CharacterClass, Interactable, Room
from qff.quest_engine import handle_interactable_use
from qff.session_payload import build_area_map

User = get_user_model()


class InteractableMinimapToggleTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="Cave",
            slug="cave-tog",
            grid_width=1,
            grid_height=1,
            is_dark_minimap=True,
        )
        self.room = Room.objects.create(
            area=self.area,
            name="Hall",
            slug="hall",
            permanent_minimap_light=False,
        )
        self.cc = CharacterClass.objects.create(slug="war-tog", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="tog@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.character = Character.objects.create(
            user=user,
            name="Togger",
            name_normalized="togger",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        self.sconce = Interactable.objects.create(
            room=self.room,
            slug="sconce-a",
            name="brass sconce",
            kind=Interactable.Kind.SCONCE,
        )
        self.wall_map = Interactable.objects.create(
            room=self.room,
            slug="map-a",
            name="tattered map",
            kind=Interactable.Kind.MAP,
            map_reveal_minutes=60,
        )

    def test_sconce_marks_area_lit_permanently(self):
        lines_on = handle_interactable_use(self.character, self.sconce)
        self.character.refresh_from_db()
        self.assertIn(self.area.pk, self.character.sconce_full_narrative_area_ids)
        self.assertIn(
            "Using the brass sconce permanently lights up this zone.",
            lines_on,
        )

        lines_again = handle_interactable_use(self.character, self.sconce)
        self.character.refresh_from_db()
        self.assertIn(self.area.pk, self.character.sconce_full_narrative_area_ids)
        self.assertIn("The lights are already on in this zone.", lines_again)

    def test_map_toggles_full_reveal(self):
        lines_on = handle_interactable_use(self.character, self.wall_map)
        self.character.refresh_from_db()
        self.assertEqual(self.character.minimap_full_reveal_area_id, self.area.pk)
        self.assertIsNotNone(self.character.minimap_full_reveal_until)
        self.assertTrue(any("laid bare" in ln.lower() for ln in lines_on))

        lines_off = handle_interactable_use(self.character, self.wall_map)
        self.character.refresh_from_db()
        self.assertIsNone(self.character.minimap_full_reveal_until)
        self.assertIsNone(self.character.minimap_full_reveal_area_id)
        self.assertTrue(any("fold" in ln.lower() for ln in lines_off))

    def test_room_permanent_minimap_light_still_in_session_lit_set(self):
        self.room.permanent_minimap_light = True
        self.room.save(update_fields=["permanent_minimap_light", "updated_at"])
        from qff.models import CharacterRoomVisit

        CharacterRoomVisit.objects.get_or_create(character=self.character, room=self.room)
        AreaCell.objects.create(area=self.area, x=0, y=0, room=self.room)
        m = build_area_map(self.character)
        grid = m["grids"][0]
        self.assertIn(self.room.pk, grid["lit_room_ids"])
