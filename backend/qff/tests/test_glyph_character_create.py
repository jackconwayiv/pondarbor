"""Glyph-based character creation API."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from qff.models import Character, CharacterClass, Room

User = get_user_model()


def _room(slug: str) -> Room:
    from qff.models import Area

    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


class GlyphCharacterCreateTests(TestCase):
    def setUp(self):
        self.room = _room("glyph-cc")
        CharacterClass.objects.get_or_create(
            slug="legacy-war",
            defaults={
                "name": "Legacy",
                "sort_order": 99,
                "description": "",
            },
        )

    def test_create_with_glyphs_sets_class_and_stores_glyphs(self):
        u = _approved_user("glyph1@example.com")
        client = APIClient()
        client.force_login(u)
        res = client.post(
            "/api/v1/qff/character/",
            {"name": "Skirm", "glyphs": ["war", "survival"]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        body = res.json()
        self.assertTrue(body["has_character"])
        self.assertEqual(body["character"]["class_slug"], "skirmisher")
        self.assertEqual(body["character"]["glyphs"], ["war", "survival"])
        self.assertEqual(body["character_profile"]["glyphs"], ["war", "survival"])

        char = Character.objects.select_related(
            "chest_item__item",
            "main_hand_item__item",
        ).get(user=u)
        self.assertEqual(char.character_class.slug, "skirmisher")
        self.assertEqual(char.glyphs, ["war", "survival"])
        self.assertEqual(char.chest_item.item.slug, "stained-jerkin")
        self.assertEqual(char.main_hand_item.item.slug, "chipped-knife")

    def test_create_with_character_class_legacy_path_empty_glyphs(self):
        u = _approved_user("glyph2@example.com")
        client = APIClient()
        client.force_login(u)
        res = client.post(
            "/api/v1/qff/character/",
            {"name": "Legacy", "character_class": "legacy-war"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        char = Character.objects.get(user=u)
        self.assertEqual(char.character_class.slug, "legacy-war")
        self.assertEqual(char.glyphs, [])

    def test_invalid_glyphs_rejected(self):
        u = _approved_user("glyph3@example.com")
        client = APIClient()
        client.force_login(u)
        res = client.post(
            "/api/v1/qff/character/",
            {"name": "Bad", "glyphs": ["war", "nope"]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_session_without_character_has_no_class_list(self):
        u = _approved_user("glyph4@example.com")
        client = APIClient()
        client.force_login(u)
        res = client.get("/api/v1/qff/session/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertFalse(body["has_character"])
        self.assertNotIn("character_classes", body)
