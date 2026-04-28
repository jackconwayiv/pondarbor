"""America/Phoenix calendar date for Pondstead auto new-day (03:00 local boundary)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

PHOENIX = ZoneInfo("America/Phoenix")
_ROLL_HOUR = 3


def phoenix_campaign_calendar_date(now_utc: datetime | None = None) -> date:
    """
    Calendar date in America/Phoenix for the campaign "day" boundary.

    Before 03:00 local Phoenix time, the effective calendar date is the **previous**
    calendar date (same as "business date" ending at 3am).
    """
    if now_utc is None:
        now_utc = datetime.now(tz=ZoneInfo("UTC"))
    elif now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=ZoneInfo("UTC"))
    local = now_utc.astimezone(PHOENIX)
    boundary = datetime.combine(local.date(), time(_ROLL_HOUR, 0, 0), tzinfo=PHOENIX)
    if local < boundary:
        return (local.date() - timedelta(days=1))
    return local.date()
