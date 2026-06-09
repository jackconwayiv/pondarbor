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
            schedule_interval_kind=Goal.ScheduleIntervalKind.DAY,
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
            schedule_interval_kind=Goal.ScheduleIntervalKind.MONTHS,
            schedule_interval_months=2,
        )
        Goal.objects.filter(pk=goal.pk).update(created_at=created)
        goal.refresh_from_db()
        from goals.schedule import is_months_interval_active
        from goals.stats import month_target_for_goal

        self.assertTrue(is_months_interval_active(goal, date(2026, 1, 10), tz))
        self.assertFalse(is_months_interval_active(goal, date(2026, 2, 1), tz))
        self.assertTrue(is_months_interval_active(goal, date(2026, 3, 1), tz))
        self.assertEqual(month_target_for_goal(goal, date(2026, 2, 1), tz), 0)
        self.assertEqual(month_target_for_goal(goal, date(2026, 3, 1), tz), 1)

    def test_goal_visible_in_due_list_weekdays(self):
        from goals.stats import compute_goal_stats, goal_visible_in_due_list

        tz = ZoneInfo("America/Phoenix")
        goal = Goal.objects.create(
            owner_user=self.owner,
            title="Weekday only",
            kind=Goal.Kind.CONTINUOUS,
            schedule_interval_kind=Goal.ScheduleIntervalKind.WEEKDAYS,
        )
        saturday = datetime(2026, 6, 6, 12, 0, tzinfo=dt_timezone.utc)
        stats = compute_goal_stats(goal, [], [], self.owner.profile, now_utc=saturday)
        self.assertEqual(stats.today_target, 0)
        self.assertFalse(goal_visible_in_due_list(goal, stats))
        friday = datetime(2026, 6, 5, 12, 0, tzinfo=dt_timezone.utc)
        stats_fri = compute_goal_stats(goal, [], [], self.owner.profile, now_utc=friday)
        self.assertEqual(stats_fri.today_target, 1)
        self.assertTrue(goal_visible_in_due_list(goal, stats_fri))

    def test_day_interval_with_count_sets_today_target(self):
        from goals.stats import day_target_for_goal

        goal = Goal.objects.create(
            owner_user=self.owner,
            title="Hydrate",
            kind=Goal.Kind.CONTINUOUS,
            schedule_interval_kind=Goal.ScheduleIntervalKind.DAY,
            frequency_count=3,
        )
        tz = ZoneInfo("America/Phoenix")
        today = date(2026, 6, 4)
        self.assertEqual(day_target_for_goal(goal, today, tz), 3)

    def test_weekday_biweekly_due_only_on_matching_tuesdays(self):
        from goals.schedule import is_weekday_interval_due

        tz = ZoneInfo("America/Phoenix")
        created = datetime(2026, 1, 6, 12, 0, tzinfo=dt_timezone.utc)
        goal = Goal.objects.create(
            owner_user=self.owner,
            title="Biweekly trash",
            kind=Goal.Kind.CHORE,
            schedule_interval_kind=Goal.ScheduleIntervalKind.WEEKDAY,
            schedule_weekday=1,
            schedule_interval_weeks=2,
        )
        Goal.objects.filter(pk=goal.pk).update(created_at=created)
        goal.refresh_from_db()
        self.assertTrue(is_weekday_interval_due(goal, date(2026, 1, 6), tz, 0))
        self.assertFalse(is_weekday_interval_due(goal, date(2026, 1, 13), tz, 0))
        self.assertTrue(is_weekday_interval_due(goal, date(2026, 1, 20), tz, 0))
