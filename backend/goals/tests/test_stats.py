from datetime import date, datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from goals.models import CheckIn, Goal
from goals.stats import GoalStats, compute_goal_stats, sort_goals_for_display
from users.models import Profile

User = get_user_model()


class GoalStatsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="stats@example.com", password="secret12345")
        Profile.objects.update_or_create(
            user=self.owner,
            defaults={"timezone": "America/Phoenix"},
        )

    def test_pct_last_30_days_ignores_days_before_goal_created(self):
        tz = ZoneInfo("America/Phoenix")
        now_utc = datetime(2026, 6, 2, 18, 0, tzinfo=dt_timezone.utc)
        created = now_utc - timedelta(days=2)
        goal = Goal.objects.create(
            owner_user=self.owner,
            title="New habit",
            kind=Goal.Kind.CONTINUOUS,
            frequency_kind=Goal.FrequencyKind.DAILY,
        )
        Goal.objects.filter(pk=goal.pk).update(created_at=created)
        goal.refresh_from_db()
        for day_offset in (0, 1, 2):
            CheckIn.objects.create(
                goal=goal,
                owner_user=self.owner,
                occurred_at=created + timedelta(days=day_offset, hours=10),
            )
        occurrences = [(c.occurred_at, c.checkpoint_id) for c in goal.check_ins.all()]
        stats = compute_goal_stats(
            goal,
            occurrences,
            [],
            self.owner.profile,
            now_utc=now_utc,
        )
        self.assertEqual(stats.pct_last_30_days, 100.0)
        self.assertEqual(stats.pct_lifetime, 100.0)

    def test_completed_goals_sorted_most_recent_first(self):
        now = timezone.now()
        older = Goal.objects.create(
            owner_user=self.owner,
            title="Older",
            kind=Goal.Kind.ONE_TIME,
            status=Goal.Status.COMPLETED,
            completed_at=now - timedelta(days=10),
        )
        newer = Goal.objects.create(
            owner_user=self.owner,
            title="Newer",
            kind=Goal.Kind.ONE_TIME,
            status=Goal.Status.COMPLETED,
            completed_at=now - timedelta(days=1),
        )
        empty_stats = GoalStats(
            streak_current=0,
            streak_best=0,
            pct_lifetime=0,
            pct_last_30_days=0,
            days_since_last_progress=0,
            today_actual=0,
            today_target=0,
            week_actual=0,
            week_target=0,
            month_actual=0,
            month_target=0,
            urgency_score=0,
        )
        ordered = sort_goals_for_display(
            [(older, empty_stats), (newer, empty_stats)],
        )
        self.assertEqual([g.id for g, _ in ordered], [newer.id, older.id])

    def test_every_n_months_due_months_from_anchor(self):
        tz = ZoneInfo("America/Phoenix")
        created = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
        goal = Goal.objects.create(
            owner_user=self.owner,
            title="Quarterly",
            kind=Goal.Kind.CONTINUOUS,
            frequency_kind=Goal.FrequencyKind.EVERY_N_MONTHS,
            schedule_interval_months=2,
        )
        Goal.objects.filter(pk=goal.pk).update(created_at=created)
        goal.refresh_from_db()
        from goals.chore_stats import is_every_n_months_due_month
        from goals.stats import month_target_for_goal

        self.assertTrue(is_every_n_months_due_month(goal, date(2026, 1, 10), tz))
        self.assertFalse(is_every_n_months_due_month(goal, date(2026, 2, 1), tz))
        self.assertTrue(is_every_n_months_due_month(goal, date(2026, 3, 1), tz))
        self.assertEqual(month_target_for_goal(goal, date(2026, 2, 1), tz), 0)
        self.assertEqual(month_target_for_goal(goal, date(2026, 3, 1), tz), 1)
