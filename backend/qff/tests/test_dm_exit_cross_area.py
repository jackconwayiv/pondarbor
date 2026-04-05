"""DM exits may target rooms in a different area (portal / world connections)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from qff.models import Area, AreaCell, Room, RoomExit

User = get_user_model()


class DmExitCrossAreaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="dm-exit@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.client.force_login(self.staff)
        self.area1 = Area.objects.create(name="Alpha", slug="alpha-exit", grid_width=3, grid_height=3)
        self.area2 = Area.objects.create(name="Beta", slug="beta-exit", grid_width=3, grid_height=3)
        self.r_alpha = Room.objects.create(area=self.area1, name="Start", slug="start")
        self.r_beta = Room.objects.create(area=self.area2, name="Elsewhere", slug="elsewhere")
        AreaCell.objects.create(area=self.area1, x=1, y=1, room=self.r_alpha)
        AreaCell.objects.create(area=self.area2, x=0, y=0, room=self.r_beta)

    def test_post_exit_to_room_in_other_area(self):
        res = self.client.post(
            f"/api/v1/qff/dm/rooms/{self.r_alpha.id}/exits/",
            {"direction": "up", "to_room_id": self.r_beta.id},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        ex = RoomExit.objects.get(from_room=self.r_alpha, direction="up")
        self.assertEqual(ex.to_room_id, self.r_beta.id)

    def test_cardinal_exit_cross_area_skips_grid_alignment(self):
        """North/south etc. do not require offset match across areas."""
        res = self.client.post(
            f"/api/v1/qff/dm/rooms/{self.r_alpha.id}/exits/",
            {"direction": "n", "to_room_id": self.r_beta.id},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)

    def test_area_exit_list_includes_all_exits_from_rooms_in_area(self):
        RoomExit.objects.create(
            from_room=self.r_alpha,
            to_room=self.r_beta,
            direction="e",
        )
        res = self.client.get(f"/api/v1/qff/dm/areas/{self.area1.id}/exits/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["from_room_id"], self.r_alpha.id)
        self.assertEqual(data[0]["direction"], "e")
        self.assertEqual(data[0]["to_room_id"], self.r_beta.id)
