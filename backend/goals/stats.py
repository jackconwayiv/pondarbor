from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Iterable
from zoneinfo import ZoneInfo

from django.utils import timezone

from goals.models import CheckIn, Goal
from goals.schedule import (
    day_target_for_goal,
    frequency_count,
    goal_applies_to_stripe_period,
    is_day_due,
    is_month_period_active,
    is_months_interval_active,
    is_week_period_active,
    month_target_for_goal,
    period_bucket_for_interval,
    week_target_for_goal,
)

if TYPE_CHECKING:
    from users.models import Profile


@dataclass(frozen=True)
class PeriodStripe:
    today_actual: int
    today_target: int
    week_actual: int
    week_target: int
    month_actual: int
    month_target: int


@dataclass(frozen=True)
class GoalStats:
    streak_current: int
    streak_best: int
    pct_lifetime: float
    pct_last_30_days: float
    days_since_last_progress: int
    today_actual: int
    today_target: int
    week_actual: int
    week_target: int
    month_actual: int
    month_target: int
    urgency_score: float
    days_overdue: int = 0
    chore_period_state: str = "none"
    count_completed_on_time: int = 0
    count_completed_overdue: int = 0
    count_missed: int = 0
    count_completed: int = 0
    pct_completed_on_time: float = 0.0
    pct_completed_overdue: float = 0.0
    pct_completed_missed: float = 0.0


def _ongoing_kind(goal: Goal) -> bool:
    return goal.kind in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE)


def _user_tz(profile: Profile | None) -> ZoneInfo:
    tz_name = (profile.timezone if profile else None) or "America/Phoenix"
    try:
        return ZoneInfo(tz_name.strip())
    except Exception:
        return ZoneInfo("America/Phoenix")


def _week_starts_on(profile: Profile | None) -> int:
    """Python weekday Monday=0 … Sunday=6."""
    if profile is None:
        return 0
    return int(profile.meal_week_starts_on or 0)


def local_today(now_utc: datetime, tz: ZoneInfo) -> date:
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(tz).date()


def week_start_for(d: date, week_starts_on: int) -> date:
    delta = (d.weekday() - week_starts_on) % 7
    return d - timedelta(days=delta)


def month_start_for(d: date) -> date:
    return d.replace(day=1)


def goal_visible_in_due_list(goal: Goal, stats: GoalStats) -> bool:
    """Active continuous goals: show only when the current period has a target."""
    if goal.kind != Goal.Kind.CONTINUOUS:
        return True
    bucket = period_bucket_for_interval(goal.schedule_interval_kind)
    if bucket == "day":
        return stats.today_target > 0
    if bucket == "week":
        return stats.week_target > 0
    if bucket == "month":
        return stats.month_target > 0
    return True


def period_target_for_goal(
    goal: Goal,
    period: str,
    today: date | None = None,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> int:
    """Target check-ins for a single period bucket."""
    if period == "day":
        if today is None:
            return 0
        return day_target_for_goal(goal, today, tz, week_starts_on)
    if period == "week":
        return week_target_for_goal(goal, today, tz, week_starts_on)
    if period == "month":
        return month_target_for_goal(goal, today, tz)
    return 0


def _checkins_by_goal(
    goal_ids: Iterable,
    owner_user_id: int,
    since: datetime,
) -> dict:
    rows = (
        CheckIn.objects.filter(
            goal_id__in=list(goal_ids),
            owner_user_id=owner_user_id,
            occurred_at__gte=since,
        )
        .values_list("goal_id", "occurred_at", "checkpoint_id")
    )
    out: dict = defaultdict(list)
    for gid, occurred_at, cp_id in rows:
        out[gid].append((occurred_at, cp_id))
    return out


def _count_checkins_on_date(
    occurrences: list[tuple[datetime, object]],
    d: date,
    tz: ZoneInfo,
) -> int:
    n = 0
    for occurred_at, _ in occurrences:
        if occurred_at.astimezone(tz).date() == d:
            n += 1
    return n


def _count_checkins_in_range(
    occurrences: list[tuple[datetime, object]],
    start: date,
    end: date,
    tz: ZoneInfo,
) -> int:
    n = 0
    for occurred_at, _ in occurrences:
        ld = occurred_at.astimezone(tz).date()
        if start <= ld <= end:
            n += 1
    return n


def compute_period_stripe(
    goals: list[Goal],
    owner_user_id: int,
    profile: Profile | None,
    now_utc: datetime | None = None,
) -> PeriodStripe:
    now_utc = now_utc or timezone.now()
    tz = _user_tz(profile)
    today = local_today(now_utc, tz)
    wstart = week_start_for(today, _week_starts_on(profile))
    wend = wstart + timedelta(days=6)
    mstart = month_start_for(today)
    mend = today

    active_ongoing = [
        g for g in goals if _ongoing_kind(g) and g.status == Goal.Status.ACTIVE
    ]
    if not active_ongoing:
        return PeriodStripe(0, 0, 0, 0, 0, 0)

    since = now_utc - timedelta(days=62)
    by_goal = _checkins_by_goal([g.id for g in active_ongoing], owner_user_id, since)
    wso = _week_starts_on(profile)

    today_a = today_t = week_a = week_t = month_a = month_t = 0
    for g in active_ongoing:
        occ = by_goal.get(g.id, [])
        if goal_applies_to_stripe_period(g, "day"):
            today_t += period_target_for_goal(g, "day", today, tz, wso)
            today_a += _count_checkins_on_date(occ, today, tz)
        if goal_applies_to_stripe_period(g, "week"):
            week_t += period_target_for_goal(g, "week", today, tz, wso)
            week_a += _count_checkins_in_range(occ, wstart, wend, tz)
        if goal_applies_to_stripe_period(g, "month"):
            month_t += period_target_for_goal(g, "month", today, tz)
            month_a += _count_checkins_in_range(occ, mstart, mend, tz)

    return PeriodStripe(today_a, today_t, week_a, week_t, month_a, month_t)


def _last_progress_at(goal: Goal, checkpoint_completed_times: list[datetime]) -> datetime | None:
    candidates = []
    if goal.last_check_in_at:
        candidates.append(goal.last_check_in_at)
    if goal.completed_at:
        candidates.append(goal.completed_at)
    candidates.extend(checkpoint_completed_times)
    if not candidates:
        return None
    return max(candidates)


def days_since_last_progress(
    goal: Goal,
    checkpoint_completed_times: list[datetime],
    today: date,
    tz: ZoneInfo,
) -> int:
    last = _last_progress_at(goal, checkpoint_completed_times)
    if last is None:
        created_local = goal.created_at.astimezone(tz).date()
        return max(0, (today - created_local).days)
    last_date = last.astimezone(tz).date()
    return max(0, (today - last_date).days)


def _expected_periods_since(
    start: date,
    end: date,
    goal: Goal,
    tz: ZoneInfo | None = None,
    week_starts_on: int = 0,
) -> int:
    days = max(1, (end - start).days + 1)
    count = frequency_count(goal)
    if goal.kind not in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
        return max(1, days)

    kind = goal.schedule_interval_kind
    if kind == Goal.ScheduleIntervalKind.DAY:
        return days * count
    if kind == Goal.ScheduleIntervalKind.WEEK:
        return max(1, days // 7 + (1 if days % 7 else 0))
    if kind == Goal.ScheduleIntervalKind.WEEKS:
        if tz is None:
            return max(1, days // 7)
        n = 0
        w = week_start_for(start, week_starts_on)
        while w <= end:
            if is_week_period_active(goal, w, tz, week_starts_on):
                n += count
            w += timedelta(days=7)
        return max(1, n)
    if kind in (Goal.ScheduleIntervalKind.MONTH, Goal.ScheduleIntervalKind.MONTHS):
        from goals.schedule import month_index

        if kind == Goal.ScheduleIntervalKind.MONTH:
            months = max(1, month_index(end) - month_index(start) + 1)
            return months * count
        if tz is None:
            return max(1, month_index(end) - month_index(start) + 1)
        due = 0
        y, m = start.year, start.month
        while date(y, m, 1) <= end:
            d = date(y, m, 1)
            if d >= start.replace(day=1) and is_months_interval_active(goal, d, tz):
                due += count
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
        return max(1, due)
    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        if tz is None:
            return days
        n = 0
        d = start
        while d <= end:
            if is_day_due(goal, d, tz, week_starts_on):
                n += count
            d += timedelta(days=1)
        return max(1, n)
    return days


def _pct(actual: int, expected: int) -> float:
    if expected <= 0:
        return 100.0 if actual > 0 else 0.0
    return min(100.0, round(100.0 * actual / expected, 1))


def _compute_streaks(
    goal: Goal,
    occurrences: list[tuple[datetime, object]],
    today: date,
    tz: ZoneInfo,
    week_starts_on: int,
) -> tuple[int, int]:
    if goal.kind != Goal.Kind.CONTINUOUS and goal.kind != Goal.Kind.CHORE:
        return 0, 0

    kind = goal.schedule_interval_kind
    wso = week_starts_on

    def day_met(d: date) -> bool:
        target = day_target_for_goal(goal, d, tz, wso)
        if target == 0:
            return False
        if kind in (
            Goal.ScheduleIntervalKind.WEEK,
            Goal.ScheduleIntervalKind.WEEKS,
        ):
            return False
        return sum(1 for o, _ in occurrences if o.astimezone(tz).date() == d) >= target

    def week_met(wstart: date) -> bool:
        wend = wstart + timedelta(days=6)
        target = week_target_for_goal(goal, wstart, tz, wso)
        if target == 0:
            return False
        actual = _count_checkins_in_range(occurrences, wstart, wend, tz)
        return actual >= target

    def month_end_for(mstart: date) -> date:
        if mstart.month == 12:
            next_m = date(mstart.year + 1, 1, 1)
        else:
            next_m = date(mstart.year, mstart.month + 1, 1)
        return next_m - timedelta(days=1)

    def prev_month_start(mstart: date) -> date:
        if mstart.month == 1:
            return date(mstart.year - 1, 12, 1)
        return date(mstart.year, mstart.month - 1, 1)

    def month_met(mstart: date) -> bool | None:
        target = month_target_for_goal(goal, mstart, tz)
        if target == 0:
            return None
        mend = month_end_for(mstart)
        actual = _count_checkins_in_range(occurrences, mstart, mend, tz)
        return actual >= target

    current = 0
    best = 0
    bucket = period_bucket_for_interval(kind)

    if bucket == "day":
        d = today
        while day_met(d):
            current += 1
            d -= timedelta(days=1)
        run = 0
        for i in range(365):
            d = today - timedelta(days=i)
            if day_met(d):
                run += 1
                best = max(best, run)
            else:
                run = 0
        best = max(best, current)
    elif bucket == "month":
        m = month_start_for(today)
        while True:
            met = month_met(m)
            if met is None:
                m = prev_month_start(m)
                if (today.year - m.year) * 12 + (today.month - m.month) > 120:
                    break
                continue
            if not met:
                break
            current += 1
            m = prev_month_start(m)
        run = 0
        m = month_start_for(today)
        for _ in range(120):
            met = month_met(m)
            if met is None:
                m = prev_month_start(m)
                continue
            if met:
                run += 1
                best = max(best, run)
            else:
                run = 0
            m = prev_month_start(m)
        best = max(best, current)
    else:
        w = week_start_for(today, week_starts_on)
        while week_met(w):
            current += 1
            w -= timedelta(days=7)
        run = 0
        for i in range(52):
            w = week_start_for(today, week_starts_on) - timedelta(days=7 * i)
            if week_met(w):
                run += 1
                best = max(best, run)
            else:
                run = 0
        best = max(best, current)

    return current, best


def compute_goal_stats(
    goal: Goal,
    occurrences: list[tuple[datetime, object]],
    checkpoint_completed_times: list[datetime],
    profile: Profile | None,
    now_utc: datetime | None = None,
) -> GoalStats:
    now_utc = now_utc or timezone.now()
    tz = _user_tz(profile)
    today = local_today(now_utc, tz)
    wstart = week_start_for(today, _week_starts_on(profile))
    wend = wstart + timedelta(days=6)
    mstart = month_start_for(today)
    mend = today
    created_local = goal.created_at.astimezone(tz).date()
    wso = _week_starts_on(profile)

    today_actual = _count_checkins_on_date(occurrences, today, tz)
    today_target = day_target_for_goal(goal, today, tz, wso)
    week_actual = _count_checkins_in_range(occurrences, wstart, wend, tz)
    week_target = week_target_for_goal(goal, today, tz, wso)
    month_actual = _count_checkins_in_range(occurrences, mstart, mend, tz)
    month_target = month_target_for_goal(goal, today, tz)

    lifetime_expected = _expected_periods_since(created_local, today, goal, tz, wso)
    lifetime_actual = len(occurrences)
    if goal.kind == Goal.Kind.ONE_TIME:
        cp_done = len(checkpoint_completed_times)
        cp_total = goal.checkpoints.count() if hasattr(goal, "_checkpoint_count") else None
        if cp_total is None:
            cp_total = goal.checkpoints.count()
        if cp_total:
            lifetime_expected = cp_total + 1
            lifetime_actual = cp_done + (
                1 if goal.status == Goal.Status.COMPLETED else 0
            )
        else:
            lifetime_expected = 1
            lifetime_actual = 1 if goal.status == Goal.Status.COMPLETED else 0

    thirty_start = today - timedelta(days=29)
    window_start = max(thirty_start, created_local)
    last30_actual = _count_checkins_in_range(occurrences, window_start, today, tz)
    last30_expected = _expected_periods_since(window_start, today, goal, tz, wso)

    streak_current, streak_best = _compute_streaks(
        goal, occurrences, today, tz, wso
    )
    stale_days = days_since_last_progress(goal, checkpoint_completed_times, today, tz)

    from goals.chore_stats import compute_chore_period_stats

    chore_stats = compute_chore_period_stats(goal, occurrences, today, tz, wso)

    urgency = 0.0
    if goal.status == Goal.Status.ACTIVE:
        if _ongoing_kind(goal):
            if today_target > 0 and today_actual < today_target:
                urgency += 100 + (today_target - today_actual) * 10
            elif interval_week_behind(goal, week_actual, week_target):
                urgency += 50
            elif interval_month_behind(goal, month_actual, month_target):
                urgency += 50
            if chore_stats.chore_period_state == "overdue":
                urgency += 120 + chore_stats.days_overdue * 5
        else:
            open_cps = goal.checkpoints.filter(completed_at__isnull=True).count()
            if open_cps:
                urgency += 80 + stale_days * 2
            else:
                urgency += stale_days

    return GoalStats(
        streak_current=streak_current,
        streak_best=streak_best,
        pct_lifetime=_pct(lifetime_actual, lifetime_expected),
        pct_last_30_days=_pct(last30_actual, last30_expected),
        days_since_last_progress=stale_days,
        today_actual=today_actual,
        today_target=today_target,
        week_actual=week_actual,
        week_target=week_target,
        month_actual=month_actual,
        month_target=month_target,
        urgency_score=urgency,
        days_overdue=chore_stats.days_overdue,
        chore_period_state=chore_stats.chore_period_state,
        count_completed_on_time=chore_stats.count_completed_on_time,
        count_completed_overdue=chore_stats.count_completed_overdue,
        count_missed=chore_stats.count_missed,
        count_completed=chore_stats.count_completed,
        pct_completed_on_time=chore_stats.pct_completed_on_time,
        pct_completed_overdue=chore_stats.pct_completed_overdue,
        pct_completed_missed=chore_stats.pct_completed_missed,
    )


def interval_month_behind(goal: Goal, month_actual: int, month_target: int) -> bool:
    if month_target <= 0:
        return False
    return month_actual < month_target


def interval_week_behind(goal: Goal, week_actual: int, week_target: int) -> bool:
    if week_target <= 0:
        return False
    return week_actual < week_target


# Backward-compatible aliases for any external imports.
fk_month_behind = interval_month_behind
fk_week_behind = interval_week_behind


def sort_goals_for_display(goals_with_stats: list[tuple[Goal, GoalStats]]) -> list[tuple[Goal, GoalStats]]:
    def sort_key(item: tuple[Goal, GoalStats]) -> tuple:
        g, s = item
        if g.status == Goal.Status.COMPLETED:
            completed_ts = g.completed_at.timestamp() if g.completed_at else 0
            return (0, -completed_ts, g.title.lower())
        behind_today = (
            _ongoing_kind(g)
            and g.status == Goal.Status.ACTIVE
            and s.today_target > 0
            and s.today_actual < s.today_target
        )
        overdue_chore = (
            g.kind == Goal.Kind.CHORE
            and g.status == Goal.Status.ACTIVE
            and s.chore_period_state == "overdue"
        )
        partial_today = (
            _ongoing_kind(g)
            and g.status == Goal.Status.ACTIVE
            and s.today_target > 0
            and 0 < s.today_actual < s.today_target
        )
        one_time_open = g.kind == Goal.Kind.ONE_TIME and g.status == Goal.Status.ACTIVE
        return (
            1,
            0 if overdue_chore else 1,
            0 if behind_today else 1,
            0 if partial_today else 1,
            -(s.urgency_score),
            -s.days_since_last_progress if one_time_open else 0,
            g.title.lower(),
        )

    return sorted(goals_with_stats, key=sort_key)
