"""Birthday / death_date strings: ``YYYY-MM-DD`` or month-day ``MM-DD`` when year is unknown."""

from __future__ import annotations

import calendar
import re

from rest_framework.exceptions import ValidationError

_FULL_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
_PARTIAL_RE = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")


def _days_in_month(month: int, year: int | None) -> int:
    if year is not None:
        return calendar.monthrange(year, month)[1]
    if month == 2:
        return 29
    if month in (4, 6, 9, 11):
        return 30
    return 31


def _validate_month_day(month: int, day: int, year: int | None) -> None:
    if day < 1 or day > _days_in_month(month, year):
        raise ValidationError("Invalid day for month.")


def normalize_partial_date(value: str | None) -> str | None:
    """Return canonical stored value or ``None`` for empty input."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    match = _FULL_RE.match(raw)
    if match:
        year, month_s, day_s = int(match.group(1)), int(match.group(2)), int(match.group(3))
        _validate_month_day(month_s, int(day_s), year)
        return f"{year:04d}-{month_s:02d}-{int(day_s):02d}"

    match = _PARTIAL_RE.match(raw)
    if match:
        month_s, day_s = int(match.group(1)), int(match.group(2))
        _validate_month_day(month_s, day_s, None)
        return f"{month_s:02d}-{day_s:02d}"

    raise ValidationError("Use YYYY-MM-DD or MM-DD when year is unknown.")


def date_to_partial(value) -> str | None:
    """Convert a ``datetime.date`` (legacy rows) to stored string form."""
    if value is None:
        return None
    return value.strftime("%Y-%m-%d")
