"""Chore schedule periods, overdue/missed tracking, and due-list visibility."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from goals.models import Goal


def week_start_for(d: date, week_starts_on: int) -> date:
    delta = (d.weekday() - week_starts_on) % 7
    return d - timedelta(days=delta)


def month_index(d: date) -> int:
    return d.year * 12 + (d.month - 1)


def months_since_anchor(goal: Goal, d: date, tz: ZoneInfo) -> int:
    anchor = month_index(goal.created_at.astimezone(tz).date().replace(day=1))
    return month_index(d.replace(day=1)) - anchor


def is_every_n_months_due_month(goal: Goal, d: date, tz: ZoneInfo) -> bool:
    interval = max(1, goal.schedule_interval_months or 1)
    ms = months_since_anchor(goal, d, tz)
    return ms >= 0 and ms % interval == 0


CHORE_OVERDUE_FREQUENCIES = frozenset(
    {
        Goal.FrequencyKind.ON_WEEKDAY,
        Goal.FrequencyKind.ON_MONTH_DAY,
        Goal.FrequencyKind.WEEKLY,
        Goal.FrequencyKind.TIMES_PER_WEEK,
        Goal.FrequencyKind.WEEKDAYS,
        Goal.FrequencyKind.MONTHLY,
        Goal.FrequencyKind.TIMES_PER_MONTH,
        Goal.FrequencyKind.EVERY_N_MONTHS,
    }
)


def chore_supports_overdue(goal: Goal) -> bool:
    if goal.kind != Goal.Kind.CHORE:
        return False
    return goal.frequency_kind in CHORE_OVERDUE_FREQUENCIES


def effective_month_day(day: int, year: int, month: int) -> int:
    last = calendar.monthrange(year, month)[1]
    return min(day, last)


def scheduled_month_day_for(goal: Goal, year: int, month: int) -> int:
    assert goal.schedule_month_day is not None
    return effective_month_day(goal.schedule_month_day, year, month)


def chore_due_on_date(
    goal: Goal,
    d: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> bool:
    if goal.kind != Goal.Kind.CHORE:
        return False
    fk = goal.frequency_kind
    if fk == Goal.FrequencyKind.ON_WEEKDAY:
        if goal.schedule_weekday is None:
            return False
        if d.weekday() != goal.schedule_weekday:
            return False
        interval = max(1, goal.schedule_interval_weeks or 1)
        if interval == 1:
            return True
        anchor = week_start_for(goal.created_at.astimezone(tz).date(), week_starts_on)
        period_week = week_start_for(d, week_starts_on)
        weeks_since = (period_week - anchor).days // 7
        return weeks_since >= 0 and weeks_since % interval == 0
    if fk == Goal.FrequencyKind.ON_MONTH_DAY:
        if goal.schedule_month_day is None:
            return False
        return d.day == scheduled_month_day_for(goal, d.year, d.month)
    if fk in (Goal.FrequencyKind.DAILY, Goal.FrequencyKind.TIMES_PER_DAY):
        return True
    if fk == Goal.FrequencyKind.WEEKDAYS:
        return d.weekday() < 5
    if fk in (Goal.FrequencyKind.WEEKLY, Goal.FrequencyKind.TIMES_PER_WEEK):
        return True
    if fk in (Goal.FrequencyKind.MONTHLY, Goal.FrequencyKind.TIMES_PER_MONTH):
        return True
    if fk == Goal.FrequencyKind.EVERY_N_MONTHS:
        return is_every_n_months_due_month(goal, d, tz)
    return False


def _period_due_dates_since(
    goal: Goal,
    start: date,
    end: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> list[date]:
    fk = goal.frequency_kind
    out: list[date] = []
    if fk == Goal.FrequencyKind.ON_WEEKDAY:
        if goal.schedule_weekday is None:
            return out
        interval = max(1, goal.schedule_interval_weeks or 1)
        anchor = week_start_for(goal.created_at.astimezone(tz).date(), week_starts_on)
        d = start
        while d <= end:
            if d.weekday() == goal.schedule_weekday:
                period_week = week_start_for(d, week_starts_on)
                weeks_since = (period_week - anchor).days // 7
                if weeks_since >= 0 and weeks_since % interval == 0:
                    out.append(d)
            d += timedelta(days=1)
        return out
    if fk == Goal.FrequencyKind.ON_MONTH_DAY:
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
    if fk in (Goal.FrequencyKind.DAILY, Goal.FrequencyKind.TIMES_PER_DAY, Goal.FrequencyKind.WEEKDAYS):
        d = start
        while d <= end:
            if chore_due_on_date(goal, d, tz, week_starts_on):
                out.append(d)
            d += timedelta(days=1)
        return out
    if fk in (Goal.FrequencyKind.WEEKLY, Goal.FrequencyKind.TIMES_PER_WEEK):
        w = week_start_for(start, week_starts_on)
        while w <= end:
            out.append(w)
            w += timedelta(days=7)
        return out
    if fk in (Goal.FrequencyKind.MONTHLY, Goal.FrequencyKind.TIMES_PER_MONTH):
        y, m = start.year, start.month
        while date(y, m, 1) <= end:
            out.append(date(y, m, 1))
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
        return out
    if fk == Goal.FrequencyKind.EVERY_N_MONTHS:
        y, m = start.year, start.month
        while date(y, m, 1) <= end:
            due = date(y, m, 1)
            if start <= due <= end and is_every_n_months_due_month(goal, due, tz):
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
