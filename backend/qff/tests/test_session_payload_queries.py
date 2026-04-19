"""Session payload must not issue O(visited_cells) RoomExit queries for the area map."""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    CharacterExitSeen,
    CharacterRoomVisit,
    Room,
    RoomExit,
)
from qff.session_payload import build_area_map, build_session_for_character

User = get_user_model()


def _roomexit_sql_hits(captured: list) -> int:
    return sum(1 for q in captured if "qff_roomexit" in q["sql"].lower())


class BuildAreaMapQueryTests(TestCase):
    """Regression: area map used one RoomExit query per cell; remote DB latency stacks badly."""

    def setUp(self):
        self.area = Area.objects.create(
            name="QueryGrid",
            slug="query-grid",
            grid_width=5,
            grid_height=5,
        )
        self.cc = CharacterClass.objects.create(slug="q-war", name="Warrior", sort_order=0)
        self.rooms: list[Room] = []
        for i in range(25):
            self.rooms.append(
                Room.objects.create(
                    area=self.area,
                    name=f"Cell{i}",
                    slug=f"query-r{i}",
                )
            )
        for y in range(5):
            for x in range(5):
                idx = y * 5 + x
                AreaCell.objects.create(
                    area=self.area, x=x, y=y, room=self.rooms[idx]
                )
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

        user = User.objects.create_user(email="mapper@example.com", password="test-pass-12345")
        self.character = Character.objects.create(
            user=user,
            name="Mapper",
            name_normalized="mapper",
            character_class=self.cc,
            current_room=self.rooms[0],
            spawn_room=self.rooms[0],
            last_activity_at=timezone.now(),
        )
        for r in self.rooms:
            CharacterRoomVisit.objects.create(character=self.character, room=r)
        for ex in RoomExit.objects.all():
            CharacterExitSeen.objects.create(character=self.character, room_exit=ex)

    def _fresh_character(self) -> Character:
        return Character.objects.select_related(
            "character_class",
            "current_room",
            "current_room__area",
            "spawn_room",
            "head_item__item",
            "main_hand_item__item",
            "off_hand_item__item",
            "chest_item__item",
            "feet_item__item",
            "ring_item__item",
            "amulet_item__item",
        ).get(pk=self.character.pk)

    def test_build_area_map_does_not_query_roomexit_per_cell(self):
        char = self._fresh_character()
        with CaptureQueriesContext(connection) as ctx:
            build_area_map(char)
        self.assertLessEqual(
            _roomexit_sql_hits(ctx.captured_queries),
            6,
            "Expected bulk RoomExit fetch, not one query per map cell",
        )

    def test_build_session_interactables_match_you_see_prefix(self):
        char = self._fresh_character()
        session = build_session_for_character(char)
        interact = session["room"]["interactables"]
        you_see = session["room"]["youSee"]
        self.assertEqual(
            [o["name"] for o in interact],
            you_see[: len(interact)],
        )
