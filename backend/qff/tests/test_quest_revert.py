"""Timed quest state revert (silent rewind)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.models import (
    Area,
    Character,
    CharacterClass,
    CharacterQuestProgress,
    Quest,
    QuestState,
    QuestTransition,
    Room,
)
from qff.quest_engine import apply_due_quest_reverts, apply_transition

User = get_user_model()


class QuestRevertTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="QR",
            slug="qr-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="R", slug="qr-room")
        self.cc = CharacterClass.objects.create(slug="war-qr", name="Warrior", sort_order=0)
        user = User.objects.create_user(email="qr@example.com", password="secret12345")
        self.character = Character.objects.create(
            user=user,
            name="Hero",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
        )
        self.quest = Quest.objects.create(slug="q-rev", name="Rev")
        self.st_a = QuestState.objects.create(
            quest=self.quest, slug="a", name="A", is_initial=True, sort_order=0
        )
        self.st_b = QuestState.objects.create(
            quest=self.quest, slug="b", name="B", sort_order=1
        )
        self.tr = QuestTransition.objects.create(
            quest=self.quest,
            from_state=self.st_a,
            to_state=self.st_b,
            revert_after_minutes=30,
            revert_to_state=self.st_a,
        )
        self.cqp = CharacterQuestProgress.objects.create(
            character=self.character,
            quest=self.quest,
            current_state=self.st_a,
        )

    def test_apply_transition_schedules_revert(self):
        apply_transition(self.character, self.tr)
        self.cqp.refresh_from_db()
        self.assertEqual(self.cqp.current_state_id, self.st_b.id)
        self.assertIsNotNone(self.cqp.quest_revert_at)
        self.assertEqual(self.cqp.quest_revert_to_state_id, self.st_a.id)

    def test_apply_due_quest_reverts(self):
        apply_transition(self.character, self.tr)
        self.cqp.refresh_from_db()
        future = self.cqp.quest_revert_at
        assert future is not None
        self.cqp.quest_revert_at = timezone.now()
        self.cqp.save(update_fields=["quest_revert_at", "updated_at"])
        apply_due_quest_reverts(self.character)
        self.cqp.refresh_from_db()
        self.assertEqual(self.cqp.current_state_id, self.st_a.id)
        self.assertIsNone(self.cqp.quest_revert_at)
        self.assertIsNone(self.cqp.quest_revert_to_state_id)
