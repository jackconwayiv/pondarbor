"""Realm-wide (fanned) room broadcasts: enter, leave, scope field on action_log."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from qff.models import Area, Character, CharacterClass, Room, RoomBroadcast
from qff.realm_presence import broadcast_realm_depart, broadcast_realm_enter
from qff.session_payload import consume_room_broadcast_entries

User = get_user_model()


def _approved_user(email: str) -> User:
    u = User.objects.create_user(email=email, password="test-pass-12345")
    u.account_status = User.AccountStatus.APPROVED
    u.is_staff = False
    u.save(update_fields=["account_status", "is_staff"])
    return u


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"Area-{slug}",
        slug=f"ar-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


class RealmPresenceBroadcastTests(TestCase):
    def setUp(self):
        self.a = _room("rpa")
        self.b = _room("rpb")
        self.cc = CharacterClass.objects.create(slug="c-rpb", name="Fighter", sort_order=0)

    def _char(self, name: str, user: User, room: Room) -> Character:
        return Character.objects.create(
            user=user,
            name=name,
            character_class=self.cc,
            current_room=room,
            spawn_room=room,
            last_activity_at=timezone.now(),
        )

    def test_realm_enter_fans_to_other_rooms(self):
        u1 = _approved_user("e1@example.com")
        u2 = _approved_user("e2@example.com")
        c2 = self._char("Benedict", u2, self.b)
        c1 = self._char("Aster", u1, self.a)
        Character.objects.filter(pk=c1.pk).update(is_in_realm=False)
        c1 = Character.objects.get(pk=c1.pk)
        self.assertFalse(c1.is_in_realm)
        Character.objects.filter(pk=c1.pk).update(
            is_in_realm=True,
            last_activity_at=timezone.now(),
        )
        c1 = Character.objects.get(pk=c1.pk)
        rooms = broadcast_realm_enter(c1)
        self.assertIn(self.b.pk, rooms, msg="Peer in other room should get a fanned row")
        rb = (
            RoomBroadcast.objects.filter(
                room_id=self.b, scope=RoomBroadcast.Scope.REALM, speaker_id=c1.pk
            )
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(rb)
        self.assertIn("Aster", rb.text)
        self.assertIn("entered", rb.text.lower())

    def test_realm_depart_session_action_log_includes_scope(self):
        u1 = _approved_user("d1@example.com")
        u2 = _approved_user("d2@example.com")
        c1 = self._char("Quinn", u1, self.a)
        c2 = self._char("Riley", u2, self.b)
        broadcast_realm_depart(c1, f"{c1.name} has left the realm (test).")
        c2 = Character.objects.get(pk=c2.pk)
        entries = consume_room_broadcast_entries(c2)
        self.assertEqual(len(entries), 1)
        self.assertIn("Quinn", entries[0]["text"])
        self.assertEqual(entries[0]["scope"], RoomBroadcast.Scope.REALM)

    def test_session_activity_posts_enter_only_when_not_previously_in_realm(self):
        u1 = _approved_user("s1@example.com")
        u2 = _approved_user("s2@example.com")
        c2 = self._char("Morgan", u2, self.b)
        c1 = self._char("Nico", u1, self.a)
        Character.objects.filter(pk=c1.pk).update(is_in_realm=False)
        client = APIClient()
        client.force_login(u1)
        res = client.post("/api/v1/qff/session/activity/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        n1 = RoomBroadcast.objects.filter(
            room_id=self.b, speaker_id=c1.pk, scope=RoomBroadcast.Scope.REALM
        ).count()
        self.assertGreaterEqual(n1, 1)
        res2 = client.post("/api/v1/qff/session/activity/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        n2 = RoomBroadcast.objects.filter(
            room_id=self.b, speaker_id=c1.pk, scope=RoomBroadcast.Scope.REALM
        ).count()
        self.assertEqual(
            n1, n2, msg="second activity should not add another global enter for same user"
        )

    def test_safe_leave_uses_realm_fanned_vanish(self):
        u1 = _approved_user("l1@example.com")
        u2 = _approved_user("l2@example.com")
        self.b.is_safe = True
        self.b.save(update_fields=["is_safe"])
        c1 = self._char("Evan", u1, self.b)
        c2 = self._char("Dana", u2, self.a)
        from qff.command_handlers import execute_command
        from qff.command_parser import ParsedLeave

        execute_command(c1, ParsedLeave())
        c1 = Character.objects.get(pk=c1.pk)
        c2 = Character.objects.get(pk=c2.pk)
        self.assertFalse(c1.is_in_realm)
        entries = consume_room_broadcast_entries(c2)
        self.assertTrue(any("Evan" in e["text"] and "vanishes" in e["text"] for e in entries))
        self.assertEqual(entries[0]["scope"], RoomBroadcast.Scope.REALM)
