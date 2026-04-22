"""Session ``active_heroes`` for the play / who panel."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.constants import AFK_LOBBY_KICK_MINUTES
from qff.models import Area, Character, CharacterClass, Room
from qff.session_payload import build_session_for_character

User = get_user_model()


def _approved_user(email: str):
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


def _area_room(area_name: str, area_slug: str, room_slug: str) -> Room:
    area = Area.objects.create(
        name=area_name,
        slug=area_slug,
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="R", slug=room_slug)


class ActiveHeroesSessionTests(TestCase):
    def setUp(self):
        self.cc = CharacterClass.objects.create(slug="surv", name="Survivalist", sort_order=0)
        self.room_a = _area_room("Overrun Bunker", "active-who-a", "aw-a")
        self.room_b = _area_room("Other Zone", "active-who-b", "aw-b")

    def _char(self, name: str, user, room: Room) -> Character:
        return Character.objects.create(
            user=user,
            name=name,
            character_class=self.cc,
            current_room=room,
            spawn_room=room,
            last_activity_at=timezone.now(),
            level=3,
        )

    def test_active_heroes_includes_in_realm_recent_by_area(self):
        u1 = _approved_user("a1@example.com")
        u2 = _approved_user("a2@example.com")
        billy = self._char("Billy", u1, self.room_a)
        self._char("Zed", u2, self.room_b)
        session = build_session_for_character(billy)
        heroes = session["active_heroes"]
        self.assertEqual(len(heroes), 2)
        by_name = {h["name"]: h for h in heroes}
        self.assertEqual(by_name["Billy"]["level"], 3)
        self.assertEqual(by_name["Billy"]["class_name"], "Survivalist")
        self.assertEqual(by_name["Billy"]["area_name"], "Overrun Bunker")
        self.assertEqual(by_name["Zed"]["area_name"], "Other Zone")
        for h in heroes:
            self.assertEqual(set(h.keys()), {"name", "level", "class_name", "area_name"})

    def test_active_heroes_excludes_stale_last_activity(self):
        u_view = _approved_user("viewer@example.com")
        u_stale = _approved_user("stalep@example.com")
        viewer = self._char("Viewer", u_view, self.room_a)
        stale = self._char("StaleMate", u_stale, self.room_b)
        Character.objects.filter(pk=stale.pk).update(
            last_activity_at=timezone.now() - timedelta(minutes=AFK_LOBBY_KICK_MINUTES + 1)
        )
        viewer = Character.objects.get(pk=viewer.pk)
        session = build_session_for_character(viewer)
        names = [h["name"] for h in session["active_heroes"]]
        self.assertIn("Viewer", names)
        self.assertNotIn("StaleMate", names)
