"""DM cell placement: dropping on an occupied cell swaps rooms instead of orphaning one."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from qff.models import Area, AreaCell, Room

User = get_user_model()


class DmCellSwapTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="dm@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.client.force_login(self.staff)
        self.area = Area.objects.create(
            name="Test",
            slug="test-swap",
            grid_width=5,
            grid_height=5,
        )
        self.r_a = Room.objects.create(area=self.area, name="Room A", slug="a")
        self.r_b = Room.objects.create(area=self.area, name="Room B", slug="b")
        AreaCell.objects.create(area=self.area, x=1, y=2, room=self.r_a)
        AreaCell.objects.create(area=self.area, x=3, y=4, room=self.r_b)

    def _post_cell(self, room_id: int, x: int, y: int):
        return self.client.post(
            f"/api/v1/qff/dm/areas/{self.area.id}/cells/",
            {"room_id": room_id, "x": x, "y": y},
            format="json",
        )

    def test_swap_moves_both_rooms(self):
        """Drag A onto B: A ends at B's cell, B ends at A's former cell."""
        res = self._post_cell(self.r_a.id, 3, 4)
        self.assertEqual(res.status_code, 201)
        self.assertTrue(AreaCell.objects.filter(room=self.r_a, x=3, y=4).exists())
        self.assertTrue(AreaCell.objects.filter(room=self.r_b, x=1, y=2).exists())
        self.assertEqual(AreaCell.objects.filter(area=self.area).count(), 2)

    def test_move_to_empty_cell(self):
        res = self._post_cell(self.r_a.id, 0, y=0)
        self.assertEqual(res.status_code, 201)
        self.assertTrue(AreaCell.objects.filter(room=self.r_a, x=0, y=0).exists())
        self.assertTrue(AreaCell.objects.filter(room=self.r_b, x=3, y=4).exists())

    def test_idempotent_same_cell(self):
        res = self._post_cell(self.r_a.id, 1, 2)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(AreaCell.objects.filter(room=self.r_a, x=1, y=2).exists())
