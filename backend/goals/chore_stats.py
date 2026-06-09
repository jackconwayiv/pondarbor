"""Chore schedule periods, overdue/missed tracking, and due-list visibility."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from goals.models import Goal
from goals.schedule import (
    chore_due_on_date,
    chore_supports_overdue,
    is_month_day_interval_due,
    is_months_interval_active,
    is_weekday_interval_due,
    is_weeks_interval_active,
    scheduled_month_day_for,
    week_start_for,
)

__all__ = [
    "ChorePeriodStats",
    "chore_due_on_date",
    "chore_supports_overdue",
    "chore_visible_in_due_list",
    "compute_chore_period_stats",
    "is_months_interval_active",
    "month_index",
    "months_since_anchor",
]


def month_index(d: date) -> int:
    from goals.schedule import month_index as _month_index

    return _month_index(d)


def months_since_anchor(goal: Goal, d: date, tz: ZoneInfo) -> int:
    from goals.schedule import months_since_anchor as _months_since_anchor

    return _months_since_anchor(goal, d, tz)


def is_months_interval_active(goal: Goal, d: date, tz: ZoneInfo) -> bool:
    from goals.schedule import is_months_interval_active as _active

    return _active(goal, d, tz)


def _period_due_dates_since(
    goal: Goal,
    start: date,
    end: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> list[date]:
    kind = goal.schedule_interval_kind
    out: list[date] = []
    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        if goal.schedule_weekday is None:
            return out
        d = start
        while d <= end:
            if is_weekday_interval_due(goal, d, tz, week_starts_on):
                out.append(d)
            d += timedelta(days=1)
        return out
    if kind == Goal.ScheduleIntervalKind.MONTH_DAY:
        if goal.schedule_month_day is None:
            return out
        y, m = start.year, start.month
        while date(y, m, 1) <= end:
            due = date(y, m, scheduled_month_day_for(goal, y, m))
            if start <= due <= end:
                out.append(due)
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
        return out
    if kind in (
        Goal.ScheduleIntervalKind.DAY,
        Goal.ScheduleIntervalKind.WEEKDAYS,
    ):
        d = start
        while d <= end:
            if chore_due_on_date(goal, d, tz, week_starts_on):
                out.append(d)
            d += timedelta(days=1)
        return out
    if kind == Goal.ScheduleIntervalKind.WEEK:
        w = week_start_for(start, week_starts_on)
        while w <= end:
            out.append(w)
            w += timedelta(days=7)
        return out
    if kind == Goal.ScheduleIntervalKind.WEEKS:
        w = week_start_for(start, week_starts_on)
        while w <= end:
            if is_weeks_interval_active(goal, w, tz, week_starts_on):
                out.append(w)
            w += timedelta(days=7)
        return out
    if kind in (Goal.ScheduleIntervalKind.MONTH, Goal.ScheduleIntervalKind.MONTHS):
        y, m = start.year, start.month
        while date(y, m, 1) <= end:
            due = date(y, m, 1)
            if kind == Goal.ScheduleIntervalKind.MONTH or is_months_interval_active(goal, due, tz):
                if start <= due <= end:
                    out.append(due)
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
        return out
    return out


def _checkin_dates(occurrences: list[tuple[datetime, object]], tz: ZoneInfo) -> list[date]:
    return sorted({o.astimezone(tz).date() for o, _ in occurrences})


@dataclass(frozen=True)
class ChorePeriodStats:
    days_overdue: int
    chore_period_state: str
    count_completed_on_time: int
    count_completed_overdue: int
    count_missed: int
    count_completed: int
    pct_completed_on_time: float
    pct_completed_overdue: float
    pct_completed_missed: float


def _empty_chore_period_stats() -> ChorePeriodStats:
    return ChorePeriodStats(0, "none", 0, 0, 0, 0, 0.0, 0.0, 0.0)


def compute_chore_period_stats(
    goal: Goal,
    occurrences: list[tuple[datetime, object]],
    today: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> ChorePeriodStats:
    if goal.kind != Goal.Kind.CHORE:
        return _empty_chore_period_stats()

    created = goal.created_at.astimezone(tz).date()
    due_dates = _period_due_dates_since(goal, created, today, tz, week_starts_on)
    if not due_dates:
        return _empty_chore_period_stats()

    checkins = _checkin_dates(occurrences, tz)
    on_time = overdue = missed = 0

    for i, due in enumerate(due_dates):
        if due > today:
            break
        next_due = due_dates[i + 1] if i + 1 < len(due_dates) else None
        if next_due is not None and next_due <= today:
            window_end = next_due - timedelta(days=1)
        else:
            window_end = today

        completions = [c for c in checkins if due <= c <= window_end]
        if completions:
            first = min(completions)
            if first == due:
                on_time += 1
            else:
                overdue += 1
        elif next_due is not None and next_due <= today:
            missed += 1

    open_due: date | None = None
    for i, due in enumerate(due_dates):
        if due > today:
            break
        next_due = due_dates[i + 1] if i + 1 < len(due_dates) else None
        window_end = today if next_due is None or next_due > today else next_due - timedelta(days=1)
        completions = [c for c in checkins if due <= c <= window_end]
        if not completions:
            open_due = due
            break

    days_overdue = 0
    state = "none"
    if open_due is not None:
        if open_due == today:
            state = "due"
        elif open_due < today and chore_supports_overdue(goal):
            state = "overdue"
            days_overdue = (today - open_due).days
        else:
            state = "due"

    total = on_time + overdue + missed
    count_completed = on_time + overdue
    if total == 0:
        pcts = (0.0, 0.0, 0.0)
    else:
        pcts = (
            round(100.0 * on_time / total, 1),
            round(100.0 * overdue / total, 1),
            round(100.0 * missed / total, 1),
        )

    return ChorePeriodStats(
        days_overdue=days_overdue,
        chore_period_state=state,
        count_completed_on_time=on_time,
        count_completed_overdue=overdue,
        count_missed=missed,
        count_completed=count_completed,
        pct_completed_on_time=pcts[0],
        pct_completed_overdue=pcts[1],
        pct_completed_missed=pcts[2],
    )


def chore_visible_in_due_list(
    goal: Goal,
    today: date,
    tz: ZoneInfo,
    week_starts_on: int,
    stats,
) -> bool:
    if goal.kind != Goal.Kind.CHORE:
        return True
    if stats.chore_period_state in ("due", "overdue"):
        return True
    return chore_due_on_date(goal, today, tz, week_starts_on)
