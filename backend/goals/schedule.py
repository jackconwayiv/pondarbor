"""Schedule interval helpers: due dates, period buckets, and targets."""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from goals.models import Goal


def frequency_count(goal: Goal) -> int:
    return max(1, goal.frequency_count or 1)


def week_start_for(d: date, week_starts_on: int) -> date:
    delta = (d.weekday() - week_starts_on) % 7
    return d - timedelta(days=delta)


def month_index(d: date) -> int:
    return d.year * 12 + (d.month - 1)


def months_since_anchor(goal: Goal, d: date, tz: ZoneInfo) -> int:
    anchor = month_index(goal.created_at.astimezone(tz).date().replace(day=1))
    return month_index(d.replace(day=1)) - anchor


def weeks_since_anchor(goal: Goal, d: date, tz: ZoneInfo, week_starts_on: int) -> int:
    anchor = week_start_for(goal.created_at.astimezone(tz).date(), week_starts_on)
    period_week = week_start_for(d, week_starts_on)
    return (period_week - anchor).days // 7


def effective_month_day(day: int, year: int, month: int) -> int:
    last = calendar.monthrange(year, month)[1]
    return min(day, last)


def scheduled_month_day_for(goal: Goal, year: int, month: int) -> int:
    assert goal.schedule_month_day is not None
    return effective_month_day(goal.schedule_month_day, year, month)


def is_months_interval_active(goal: Goal, d: date, tz: ZoneInfo) -> bool:
    interval = max(1, goal.schedule_interval_months or 1)
    ms = months_since_anchor(goal, d, tz)
    return ms >= 0 and ms % interval == 0


def is_weeks_interval_active(goal: Goal, d: date, tz: ZoneInfo, week_starts_on: int) -> bool:
    interval = max(1, goal.schedule_interval_weeks or 1)
    if interval == 1:
        return True
    ws = weeks_since_anchor(goal, d, tz, week_starts_on)
    return ws >= 0 and ws % interval == 0


def is_weekday_interval_due(goal: Goal, d: date, tz: ZoneInfo, week_starts_on: int) -> bool:
    if goal.schedule_weekday is None:
        return False
    if d.weekday() != goal.schedule_weekday:
        return False
    return is_weeks_interval_active(goal, d, tz, week_starts_on)


def is_month_day_interval_due(goal: Goal, d: date) -> bool:
    if goal.schedule_month_day is None:
        return False
    return d.day == scheduled_month_day_for(goal, d.year, d.month)


def is_day_due(
    goal: Goal,
    d: date,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> bool:
    kind = goal.schedule_interval_kind
    if kind == Goal.ScheduleIntervalKind.DAY:
        return True
    if kind == Goal.ScheduleIntervalKind.WEEKDAYS:
        return d.weekday() < 5
    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        if tz is None:
            return False
        return is_weekday_interval_due(goal, d, tz, week_starts_on)
    return False


def is_week_period_active(
    goal: Goal,
    d: date,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> bool:
    kind = goal.schedule_interval_kind
    if kind == Goal.ScheduleIntervalKind.WEEK:
        return True
    if kind == Goal.ScheduleIntervalKind.WEEKS:
        if tz is None:
            return False
        return is_weeks_interval_active(goal, d, tz, week_starts_on)
    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        return True
    return False


def is_month_period_active(goal: Goal, d: date, tz: ZoneInfo | None = None) -> bool:
    kind = goal.schedule_interval_kind
    if kind == Goal.ScheduleIntervalKind.MONTH:
        return True
    if kind == Goal.ScheduleIntervalKind.MONTHS:
        if tz is None:
            return False
        return is_months_interval_active(goal, d, tz)
    if kind == Goal.ScheduleIntervalKind.MONTH_DAY:
        return True
    return False


def period_bucket_for_interval(kind: str) -> str:
    """Primary bucket for streaks and due-list visibility."""
    if kind in (
        Goal.ScheduleIntervalKind.DAY,
        Goal.ScheduleIntervalKind.WEEKDAYS,
    ):
        return "day"
    if kind in (
        Goal.ScheduleIntervalKind.MONTH,
        Goal.ScheduleIntervalKind.MONTHS,
        Goal.ScheduleIntervalKind.MONTH_DAY,
    ):
        return "month"
    return "week"


def goal_applies_to_stripe_period(goal: Goal, period: str) -> bool:
    if goal.kind not in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
        return False
    if goal.status != Goal.Status.ACTIVE:
        return False
    kind = goal.schedule_interval_kind
    if period == "day":
        return kind in (
            Goal.ScheduleIntervalKind.DAY,
            Goal.ScheduleIntervalKind.WEEKDAYS,
        )
    if period == "week":
        return kind in (
            Goal.ScheduleIntervalKind.WEEK,
            Goal.ScheduleIntervalKind.WEEKS,
            Goal.ScheduleIntervalKind.WEEKDAY,
        )
    if period == "month":
        return kind in (
            Goal.ScheduleIntervalKind.MONTH,
            Goal.ScheduleIntervalKind.MONTHS,
            Goal.ScheduleIntervalKind.MONTH_DAY,
        )
    return False


CHORE_OVERDUE_INTERVALS = frozenset(
    {
        Goal.ScheduleIntervalKind.WEEKDAY,
        Goal.ScheduleIntervalKind.MONTH_DAY,
        Goal.ScheduleIntervalKind.WEEK,
        Goal.ScheduleIntervalKind.WEEKS,
        Goal.ScheduleIntervalKind.WEEKDAYS,
        Goal.ScheduleIntervalKind.MONTH,
        Goal.ScheduleIntervalKind.MONTHS,
    }
)


def chore_supports_overdue(goal: Goal) -> bool:
    if goal.kind != Goal.Kind.CHORE:
        return False
    return goal.schedule_interval_kind in CHORE_OVERDUE_INTERVALS


def day_target_for_goal(
    goal: Goal,
    today: date,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> int:
    if goal.kind not in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
        return 0
    if not is_day_due(goal, today, tz, week_starts_on):
        return 0
    return frequency_count(goal)


def week_target_for_goal(
    goal: Goal,
    today: date | None = None,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> int:
    if goal.kind not in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
        return 0
    if today is None:
        return 0
    if not is_week_period_active(goal, today, tz, week_starts_on):
        return 0
    return frequency_count(goal)


def month_target_for_goal(
    goal: Goal,
    today: date | None = None,
    tz: ZoneInfo | None = None,
) -> int:
    if goal.kind not in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
        return 0
    if today is None:
        return 0
    if not is_month_period_active(goal, today, tz):
        return 0
    return frequency_count(goal)


def chore_due_on_date(
    goal: Goal,
    d: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> bool:
    if goal.kind != Goal.Kind.CHORE:
        return False
    kind = goal.schedule_interval_kind
    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        return is_weekday_interval_due(goal, d, tz, week_starts_on)
    if kind == Goal.ScheduleIntervalKind.MONTH_DAY:
        return is_month_day_interval_due(goal, d)
    if kind == Goal.ScheduleIntervalKind.DAY:
        return True
    if kind == Goal.ScheduleIntervalKind.WEEKDAYS:
        return d.weekday() < 5
    if kind in (Goal.ScheduleIntervalKind.WEEK, Goal.ScheduleIntervalKind.WEEKS):
        if kind == Goal.ScheduleIntervalKind.WEEK:
            return True
        return is_weeks_interval_active(goal, d, tz, week_starts_on)
    if kind in (Goal.ScheduleIntervalKind.MONTH, Goal.ScheduleIntervalKind.MONTHS):
        if kind == Goal.ScheduleIntervalKind.MONTH:
            return True
        return is_months_interval_active(goal, d, tz)
    return False
