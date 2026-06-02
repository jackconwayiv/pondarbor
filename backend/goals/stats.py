from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Iterable
from zoneinfo import ZoneInfo

from django.utils import timezone

from goals.models import CheckIn, Goal

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
    urgency_score: float


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


def goal_applies_to_stripe_period(goal: Goal, period: str) -> bool:
    """Top stripe buckets only aggregate goals on that cadence."""
    if goal.kind != Goal.Kind.CONTINUOUS or goal.status != Goal.Status.ACTIVE:
        return False
    fk = goal.frequency_kind
    if period == "day":
        return fk in (Goal.FrequencyKind.DAILY, Goal.FrequencyKind.TIMES_PER_DAY)
    if period == "week":
        return fk in (Goal.FrequencyKind.WEEKLY, Goal.FrequencyKind.TIMES_PER_WEEK)
    if period == "month":
        # Reserved for future monthly cadence; no frequency kinds yet.
        return False
    return False


def period_target_for_goal(goal: Goal, period: str) -> int:
    """Target check-ins for a single period bucket."""
    if not goal_applies_to_stripe_period(goal, period):
        return 0
    fk = goal.frequency_kind
    count = max(1, goal.frequency_count or 1)
    if period == "day":
        if fk == Goal.FrequencyKind.DAILY:
            return 1
        if fk == Goal.FrequencyKind.TIMES_PER_DAY:
            return count
    if period == "week":
        if fk == Goal.FrequencyKind.WEEKLY:
            return 1
        if fk == Goal.FrequencyKind.TIMES_PER_WEEK:
            return count
    if period == "month":
        pass
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

    active_continuous = [
        g for g in goals if g.kind == Goal.Kind.CONTINUOUS and g.status == Goal.Status.ACTIVE
    ]
    if not active_continuous:
        return PeriodStripe(0, 0, 0, 0, 0, 0)

    since = now_utc - timedelta(days=62)
    by_goal = _checkins_by_goal([g.id for g in active_continuous], owner_user_id, since)

    today_a = today_t = week_a = week_t = month_a = month_t = 0
    for g in active_continuous:
        occ = by_goal.get(g.id, [])
        if goal_applies_to_stripe_period(g, "day"):
            today_t += period_target_for_goal(g, "day")
            today_a += _count_checkins_on_date(occ, today, tz)
        if goal_applies_to_stripe_period(g, "week"):
            week_t += period_target_for_goal(g, "week")
            week_a += _count_checkins_in_range(occ, wstart, wend, tz)
        if goal_applies_to_stripe_period(g, "month"):
            month_t += period_target_for_goal(g, "month")
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


def _expected_periods_since(start: date, end: date, goal: Goal) -> int:
    days = max(1, (end - start).days + 1)
    fk = goal.frequency_kind
    count = max(1, goal.frequency_count or 1)
    if goal.kind != Goal.Kind.CONTINUOUS:
        return max(1, days)
    if fk == Goal.FrequencyKind.DAILY:
        return days
    if fk == Goal.FrequencyKind.TIMES_PER_DAY:
        return days * count
    if fk == Goal.FrequencyKind.WEEKLY:
        return max(1, days // 7 + (1 if days % 7 else 0))
    if fk == Goal.FrequencyKind.TIMES_PER_WEEK:
        weeks = max(1, (days + 6) // 7)
        return weeks * count
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
    if goal.kind != Goal.Kind.CONTINUOUS:
        return 0, 0

    fk = goal.frequency_kind

    def day_met(d: date) -> bool:
        target = period_target_for_goal(goal, "day")
        if fk in (Goal.FrequencyKind.WEEKLY, Goal.FrequencyKind.TIMES_PER_WEEK):
            return False
        if target == 0:
            return False
        return sum(1 for o, _ in occurrences if o.astimezone(tz).date() == d) >= target

    def week_met(wstart: date) -> bool:
        wend = wstart + timedelta(days=6)
        target = period_target_for_goal(goal, "week")
        if target == 0:
            return False
        actual = _count_checkins_in_range(occurrences, wstart, wend, tz)
        return actual >= target

    current = 0
    best = 0
    if fk in (Goal.FrequencyKind.DAILY, Goal.FrequencyKind.TIMES_PER_DAY):
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
    created_local = goal.created_at.astimezone(tz).date()

    today_actual = _count_checkins_on_date(occurrences, today, tz)
    today_target = period_target_for_goal(goal, "day")
    week_actual = _count_checkins_in_range(occurrences, wstart, wend, tz)
    week_target = period_target_for_goal(goal, "week")

    lifetime_expected = _expected_periods_since(created_local, today, goal)
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
    # Rolling 30d window, but never count days before the goal existed.
    window_start = max(thirty_start, created_local)
    last30_actual = _count_checkins_in_range(occurrences, window_start, today, tz)
    last30_expected = _expected_periods_since(window_start, today, goal)

    streak_current, streak_best = _compute_streaks(
        goal, occurrences, today, tz, _week_starts_on(profile)
    )
    stale_days = days_since_last_progress(goal, checkpoint_completed_times, today, tz)

    urgency = 0.0
    if goal.status == Goal.Status.ACTIVE:
        if goal.kind == Goal.Kind.CONTINUOUS:
            if today_target > 0 and today_actual < today_target:
                urgency += 100 + (today_target - today_actual) * 10
            elif fk_week_behind(goal, week_actual, week_target):
                urgency += 50
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
        urgency_score=urgency,
    )


def fk_week_behind(goal: Goal, week_actual: int, week_target: int) -> bool:
    if week_target <= 0:
        return False
    return week_actual < week_target


def sort_goals_for_display(goals_with_stats: list[tuple[Goal, GoalStats]]) -> list[tuple[Goal, GoalStats]]:
    def sort_key(item: tuple[Goal, GoalStats]) -> tuple:
        g, s = item
        if g.status == Goal.Status.COMPLETED:
            completed_ts = g.completed_at.timestamp() if g.completed_at else 0
            return (0, -completed_ts, g.title.lower())
        behind_today = (
            g.kind == Goal.Kind.CONTINUOUS
            and g.status == Goal.Status.ACTIVE
            and s.today_target > 0
            and s.today_actual < s.today_target
        )
        partial_today = (
            g.kind == Goal.Kind.CONTINUOUS
            and g.status == Goal.Status.ACTIVE
            and s.today_target > 0
            and 0 < s.today_actual < s.today_target
        )
        one_time_open = g.kind == Goal.Kind.ONE_TIME and g.status == Goal.Status.ACTIVE
        return (
            1,
            0 if behind_today else 1,
            0 if partial_today else 1,
            -(s.urgency_score),
            -s.days_since_last_progress if one_time_open else 0,
            g.title.lower(),
        )

    return sorted(goals_with_stats, key=sort_key)
