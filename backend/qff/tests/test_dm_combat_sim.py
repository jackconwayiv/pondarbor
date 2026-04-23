"""Staff-only combat sim preview API."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()

PREVIEW_URL = "/api/v1/qff/dm/combat-sim/preview/"


def _staff_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = True
    u.save(update_fields=["account_status", "is_staff"])
    return u


def _non_staff_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


class DmCombatSimPreviewTests(TestCase):
    def setUp(self):
        self.staff = _staff_user("staff-csim@example.com")
        self.user = _non_staff_user("user-csim@example.com")
        self.body = {
            "mode": "hero_attacks",
            "hero": {
                "level": 1,
                "base_gains": 5,
                "base_moves": 10,
                "base_sense": 0,
            },
            "hero_slots": {},
            "monster": {
                "level": 1,
                "moves": 0,
                "armor": 0,
                "damage_min": 1,
                "damage_max": 3,
            },
        }

    def test_staff_post_returns_200_with_expected_keys(self):
        c = APIClient()
        c.force_authenticate(self.staff)
        r = c.post(PREVIEW_URL, self.body, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.content)
        data = r.json()
        self.assertEqual(data.get("mode"), "hero_attacks")
        for k in ("attacker", "defender", "hit", "crit", "mitigation", "damage", "example_final_damage"):
            self.assertIn(k, data)
        self.assertIn("hit_chance", data["hit"])

    def test_non_staff_forbidden(self):
        c = APIClient()
        c.force_authenticate(self.user)
        r = c.post(PREVIEW_URL, self.body, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_mode_400(self):
        c = APIClient()
        c.force_authenticate(self.staff)
        bad = {**self.body, "mode": "invalid"}
        r = c.post(PREVIEW_URL, bad, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
