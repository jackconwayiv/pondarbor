from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from goals.models import Checkpoint, Goal
from users.models import Profile

User = get_user_model()


class GoalsApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="secret12345")
        self.other = User.objects.create_user(email="other@example.com", password="secret12345")
        for u in (self.owner, self.other):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.owner, defaults={"display_name": "Owner"})
        Profile.objects.update_or_create(user=self.other, defaults={"display_name": "Other"})
        self.client = APIClient()
        self.client.force_login(self.owner)
        self.other_client = APIClient()
        self.other_client.force_login(self.other)

    def test_create_continuous_goal_and_check_in(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Swim daily",
                "kind": "continuous",
                "frequency_kind": "daily",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        goal_id = r.json()["id"]
        r2 = self.client.post(f"/api/v1/goals/{goal_id}/check-ins/", {}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertIsNotNone(r2.json()["last_check_in_at"])

    def test_dashboard_stripe(self):
        self.client.post(
            "/api/v1/goals/",
            {"title": "Run", "kind": "continuous", "frequency_kind": "daily"},
            format="json",
        )
        dash = self.client.get("/api/v1/goals/dashboard/")
        self.assertEqual(dash.status_code, 200)
        stripe = dash.json()["stripe"]
        self.assertGreaterEqual(stripe["today_target"], 1)
        self.assertEqual(stripe["week_target"], 0)

    def test_dashboard_stripe_week_only_counts_weekly_goals(self):
        self.client.post(
            "/api/v1/goals/",
            {"title": "Run daily", "kind": "continuous", "frequency_kind": "daily"},
            format="json",
        )
        self.client.post(
            "/api/v1/goals/",
            {"title": "Reflect", "kind": "continuous", "frequency_kind": "weekly"},
            format="json",
        )
        stripe = self.client.get("/api/v1/goals/dashboard/").json()["stripe"]
        self.assertGreaterEqual(stripe["today_target"], 1)
        self.assertEqual(stripe["week_target"], 1)
        self.assertEqual(stripe["month_target"], 0)

    def test_one_time_checkpoint_check_in(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Build cabin",
                "kind": "one_time",
                "checkpoints": [{"title": "Foundation"}, {"title": "Roof"}],
            },
            format="json",
        )
        goal_id = r.json()["id"]
        cps = r.json()["checkpoints"]
        cp_id = cps[0]["id"]
        r2 = self.client.post(
            f"/api/v1/goals/{goal_id}/check-ins/",
            {"checkpoint_id": cp_id},
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        updated = next(c for c in r2.json()["checkpoints"] if c["id"] == cp_id)
        self.assertIsNotNone(updated["completed_at"])

    def test_goals_reset_deletes_all(self):
        for title in ("A", "B"):
            self.client.post(
                "/api/v1/goals/",
                {"title": title, "kind": "continuous"},
                format="json",
            )
        r = self.client.post(
            "/api/v1/goals/reset/",
            {"confirm": "delete_all"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["deleted"], 2)
        dash = self.client.get("/api/v1/goals/dashboard/")
        self.assertEqual(dash.json()["status_counts"]["active"], 0)

    def test_one_time_checkpoint_uncheck(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Build cabin",
                "kind": "one_time",
                "checkpoints": [{"title": "Foundation"}],
            },
            format="json",
        )
        goal_id = r.json()["id"]
        cp_id = r.json()["checkpoints"][0]["id"]
        self.client.post(
            f"/api/v1/goals/{goal_id}/check-ins/",
            {"checkpoint_id": cp_id},
            format="json",
        )
        r2 = self.client.patch(
            f"/api/v1/goals/{goal_id}/checkpoints/{cp_id}/",
            {"completed_at": None},
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        cp = next(c for c in r2.json()["checkpoints"] if c["id"] == cp_id)
        self.assertIsNone(cp["completed_at"])

    def test_one_time_check_in_requires_milestone(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Ship it", "kind": "one_time"},
            format="json",
        )
        goal_id = r.json()["id"]
        r2 = self.client.post(
            f"/api/v1/goals/{goal_id}/check-ins/",
            {},
            format="json",
        )
        self.assertEqual(r2.status_code, 400)
        self.assertIn("checkpoint", r2.json()["detail"].lower())

    def test_other_user_cannot_access_goal(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Private", "kind": "continuous"},
            format="json",
        )
        goal_id = r.json()["id"]
        r2 = self.other_client.get(f"/api/v1/goals/{goal_id}/")
        self.assertEqual(r2.status_code, 404)

    def test_mark_complete_sets_can_undo(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Ship it", "kind": "one_time"},
            format="json",
        )
        goal_id = r.json()["id"]
        patched = self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["status"], "completed")
        self.assertTrue(patched.json()["can_undo"])
        goal = Goal.objects.get(pk=goal_id)
        self.assertIsNotNone(goal.last_completion_event_at)

    def test_completed_rejects_patch_during_undo_window(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Walk", "kind": "continuous", "frequency_kind": "daily"},
            format="json",
        )
        goal_id = r.json()["id"]
        completed = self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(completed.status_code, 200)
        self.assertTrue(completed.json()["can_undo"])
        blocked = self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"title": "Changed"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

    def test_locked_completed_completable_rejects_patch(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Ship it", "kind": "one_time"},
            format="json",
        )
        goal_id = r.json()["id"]
        self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"status": "completed"},
            format="json",
        )
        goal = Goal.objects.get(pk=goal_id)
        goal.last_completion_event_at = timezone.now() - timedelta(minutes=11)
        goal.save(update_fields=["last_completion_event_at", "updated_at"])
        blocked = self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"title": "Changed"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

    def test_undo_within_window(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Meditate", "kind": "continuous", "frequency_kind": "daily"},
            format="json",
        )
        goal_id = r.json()["id"]
        check_in = self.client.post(f"/api/v1/goals/{goal_id}/check-ins/", {}, format="json")
        self.assertEqual(check_in.status_code, 200)
        self.assertTrue(check_in.json()["can_undo"])
        undo = self.client.post(f"/api/v1/goals/{goal_id}/undo/", {}, format="json")
        self.assertEqual(undo.status_code, 200)
        self.assertTrue(undo.json()["can_undo"] is False or undo.json()["last_check_in_at"] is None)

    def test_checkpoint_rejected_on_continuous(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Walk", "kind": "continuous"},
            format="json",
        )
        goal_id = r.json()["id"]
        r2 = self.client.post(
            f"/api/v1/goals/{goal_id}/checkpoints/",
            {"title": "Nope"},
            format="json",
        )
        self.assertEqual(r2.status_code, 400)

    def test_hard_delete(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Temp", "kind": "continuous"},
            format="json",
        )
        goal_id = r.json()["id"]
        self.client.delete(f"/api/v1/goals/{goal_id}/")
        self.assertEqual(Goal.objects.filter(id=goal_id).count(), 0)

    def test_create_rejects_blank_title(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "   ", "kind": "continuous"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_rejects_invalid_kind(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Run", "kind": "hacked"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_reset_requires_confirmation(self):
        r = self.client.post("/api/v1/goals/reset/", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_continuous_check_in_rejects_checkpoint(self):
        goal = Goal.objects.create(
            owner_user=self.owner,
            title="Yoga",
            kind=Goal.Kind.CONTINUOUS,
            frequency_kind=Goal.FrequencyKind.DAILY,
        )
        cp = Checkpoint.objects.create(goal=goal, title="Should not")
        r = self.client.post(
            f"/api/v1/goals/{goal.id}/check-ins/",
            {"checkpoint_id": str(cp.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_chore_and_check_in(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Vacuum",
                "kind": "chore",
                "frequency_kind": "weekly",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        goal_id = r.json()["id"]
        self.assertEqual(r.json()["kind"], "chore")
        r2 = self.client.post(f"/api/v1/goals/{goal_id}/check-ins/", {}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertIsNotNone(r2.json()["last_check_in_at"])

    def test_chore_cannot_be_marked_completed(self):
        r = self.client.post(
            "/api/v1/goals/",
            {"title": "Dishes", "kind": "chore", "frequency_kind": "daily"},
            format="json",
        )
        goal_id = r.json()["id"]
        patched = self.client.patch(
            f"/api/v1/goals/{goal_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(patched.status_code, 400)

    def test_dashboard_kind_filter_and_counts(self):
        self.client.post(
            "/api/v1/goals/",
            {"title": "Run", "kind": "continuous", "frequency_kind": "daily"},
            format="json",
        )
        self.client.post(
            "/api/v1/goals/",
            {"title": "Dishes", "kind": "chore", "frequency_kind": "daily"},
            format="json",
        )
        dash = self.client.get("/api/v1/goals/dashboard/")
        self.assertEqual(dash.status_code, 200)
        body = dash.json()
        self.assertEqual(body["kind_counts"]["continuous"], 1)
        self.assertEqual(body["kind_counts"]["chore"], 1)
        chores = self.client.get("/api/v1/goals/dashboard/?kind=chore")
        self.assertEqual(len(chores.json()["goals"]), 1)
        self.assertEqual(chores.json()["goals"][0]["kind"], "chore")
        self.assertIn("month_actual", chores.json()["goals"][0]["stats"])
        self.assertIn("chore_period_state", chores.json()["goals"][0]["stats"])

    def test_create_on_weekday_chore_requires_schedule_weekday(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Trash",
                "kind": "chore",
                "frequency_kind": "on_weekday",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        r2 = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Trash",
                "kind": "chore",
                "frequency_kind": "on_weekday",
                "schedule_weekday": 1,
            },
            format="json",
        )
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.json()["schedule_weekday"], 1)
        self.assertEqual(r2.json()["schedule_interval_weeks"], 2)

    def test_create_every_n_months_goal(self):
        r = self.client.post(
            "/api/v1/goals/",
            {
                "title": "Quarterly review",
                "kind": "continuous",
                "frequency_kind": "every_n_months",
                "schedule_interval_months": 3,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["frequency_kind"], "every_n_months")
        self.assertEqual(r.json()["schedule_interval_months"], 3)
