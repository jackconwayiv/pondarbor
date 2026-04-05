"""Bulk JSON export/import for rooms and exits in an area."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from qff.models import Area, AreaCell, Room, RoomExit

User = get_user_model()


class DmAreaRoomsJsonTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="dm-json@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.client.force_login(self.staff)
        self.area = Area.objects.create(
            name="JsonTest",
            slug="json-test-area",
            grid_width=5,
            grid_height=5,
        )
        self.r_a = Room.objects.create(area=self.area, name="Room A", slug="a")
        self.r_b = Room.objects.create(area=self.area, name="Room B", slug="b")
        AreaCell.objects.create(area=self.area, x=0, y=0, room=self.r_a)
        AreaCell.objects.create(area=self.area, x=1, y=0, room=self.r_b)
        RoomExit.objects.create(
            from_room=self.r_a,
            to_room=self.r_b,
            direction=RoomExit.Direction.E,
            is_hidden=False,
            lock_kind=RoomExit.LockKind.NONE,
        )

    def test_export_returns_snapshot(self):
        res = self.client.get(
            f"/api/v1/qff/dm/areas/{self.area.id}/rooms-export/",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["format"], "qff-area-rooms")
        self.assertEqual(data["area"]["slug"], "json-test-area")
        self.assertEqual(len(data["rooms"]), 2)
        ra = next(r for r in data["rooms"] if r["slug"] == "a")
        self.assertEqual(ra["cell"], {"x": 0, "y": 0})
        self.assertEqual(len(ra["exits"]), 1)
        self.assertEqual(ra["exits"][0]["direction"], "e")
        self.assertIsNone(ra["exits"][0]["to_area_slug"])
        self.assertEqual(ra["exits"][0]["to_room_slug"], "b")

    def test_import_roundtrip(self):
        res = self.client.get(
            f"/api/v1/qff/dm/areas/{self.area.id}/rooms-export/",
        )
        payload = res.json()
        res2 = self.client.post(
            f"/api/v1/qff/dm/areas/{self.area.id}/rooms-import/",
            payload,
            format="json",
        )
        self.assertEqual(res2.status_code, 200, res2.content)
        self.assertTrue(res2.json().get("ok"))
        self.assertEqual(Room.objects.filter(area=self.area).count(), 2)
        self.assertEqual(RoomExit.objects.filter(from_room=self.r_a).count(), 1)
