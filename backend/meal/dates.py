from __future__ import annotations

from datetime import date, timedelta


def normalize_week_start(d: date, week_starts_on: int) -> date:
    """Align `d` to the start of its week; week_starts_on uses Python weekday (Mon=0)."""
    diff = (d.weekday() - week_starts_on) % 7
    return d - timedelta(days=diff)
