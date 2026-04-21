"""Interactable paired mutual exits (device realm-unlock both legs)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from qff.models import (
    Area,
    Character,
    CharacterClass,
    Interactable,
    RealmExitUnlock,
    Room,
    RoomExit,
)
from qff.quest_engine import handle_interactable_use

User = get_user_model()


class InteractablePairedExitUnlocksTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="pair-dm@example.com",
            password="secret12345",
            is_staff=True,
        )
        self.client.force_login(self.staff)
        self.area = Area.objects.create(name="PairA", slug="pair-a", grid_width=2, grid_height=1)
        self.r_a = Room.objects.create(area=self.area, name="Room A", slug="ra")
        self.r_b = Room.objects.create(area=self.area, name="Room B", slug="rb")
        self.ex_ab = RoomExit.objects.create(
            from_room=self.r_a,
            to_room=self.r_b,
            direction="e",
            lock_kind=RoomExit.LockKind.DEVICE,
            unlock_duration_seconds=120,
        )
        self.ex_ba = RoomExit.objects.create(
            from_room=self.r_b,
            to_room=self.r_a,
            direction="w",
            lock_kind=RoomExit.LockKind.DEVICE,
            unlock_duration_seconds=60,
        )
        self.cc = CharacterClass.objects.create(slug="war-pair", name="Warrior", sort_order=0)
        self.player = User.objects.create_user(email="pair-pl@example.com", password="secret12345")
        self.player.account_status = User.AccountStatus.APPROVED
        self.player.save(update_fields=["account_status"])
        self.hero = Character.objects.create(
            user=self.player,
            name="PairHero",
            name_normalized="pairhero",
            character_class=self.cc,
            current_room=self.r_a,
            spawn_room=self.r_a,
            last_activity_at=timezone.now(),
        )

    def test_dm_exit_mutual_pair_lists_reverse_legs(self):
        res = self.client.get(f"/api/v1/qff/dm/exits/{self.ex_ab.id}/mutual-pair/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.ex_ba.id)
        self.assertEqual(data[0]["from_room_id"], self.r_b.id)
        self.assertEqual(data[0]["to_room_id"], self.r_a.id)

    def test_dm_create_interactable_secondary_without_primary_rejected(self):
        res = self.client.post(
            "/api/v1/qff/dm/interactables/",
            {
                "room_id": self.r_a.id,
                "slug": "lever-x",
                "name": "Lever X",
                "kind": Interactable.Kind.LEVER,
                "unlocks_exit_secondary_id": self.ex_ba.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_dm_create_interactable_non_mutual_pair_rejected(self):
        ex_bb = RoomExit.objects.create(
            from_room=self.r_b,
            to_room=self.r_b,
            direction="in",
        )
        res = self.client.post(
            "/api/v1/qff/dm/interactables/",
            {
                "room_id": self.r_a.id,
                "slug": "lever-y",
                "name": "Lever Y",
                "kind": Interactable.Kind.LEVER,
                "unlocks_exit_id": self.ex_ab.id,
                "unlocks_exit_secondary_id": ex_bb.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_dm_create_interactable_mutual_pair_ok(self):
        res = self.client.post(
            "/api/v1/qff/dm/interactables/",
            {
                "room_id": self.r_a.id,
                "slug": "lever-z",
                "name": "Lever Z",
                "kind": Interactable.Kind.LEVER,
                "unlocks_exit_id": self.ex_ab.id,
                "unlocks_exit_secondary_id": self.ex_ba.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        row = res.json()
        self.assertEqual(row["unlocks_exit_id"], self.ex_ab.id)
        self.assertEqual(row["unlocks_exit_secondary_id"], self.ex_ba.id)

    def test_use_interactable_unlocks_realm_for_both_exits(self):
        lever = Interactable.objects.create(
            room=self.r_a,
            slug="pair-lever",
            name="Twin lever",
            kind=Interactable.Kind.LEVER,
            unlocks_exit=self.ex_ab,
            unlocks_exit_secondary=self.ex_ba,
        )
        RealmExitUnlock.objects.filter(
            room_exit_id__in=[self.ex_ab.id, self.ex_ba.id]
        ).delete()
        handle_interactable_use(self.hero, lever)
        self.assertTrue(RealmExitUnlock.objects.filter(room_exit=self.ex_ab).exists())
        self.assertTrue(RealmExitUnlock.objects.filter(room_exit=self.ex_ba).exists())
