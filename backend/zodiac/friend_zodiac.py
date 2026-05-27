"""Helpers for friend-visible zodiac summaries."""

from __future__ import annotations

from typing import Any

from zodiac.models import AstroProfile

BIG_THREE_POINT_KEYS = ("sun", "moon")


def trim_natal_chart_for_friends(
    natal_chart: dict[str, Any] | None, *, birth_time_unknown: bool = False
) -> dict[str, Any] | None:
    if not natal_chart:
        return None
    points = natal_chart.get("points") or {}
    angles = natal_chart.get("angles") or {}
    trimmed_points = {k: points[k] for k in BIG_THREE_POINT_KEYS if k in points}
    trimmed_angles: dict[str, Any] = {}
    if not birth_time_unknown and "ascendant" in angles:
        trimmed_angles["ascendant"] = angles["ascendant"]
    if not trimmed_points and not trimmed_angles:
        return None
    return {"points": trimmed_points, "angles": trimmed_angles}


def friend_has_shareable_zodiac(astro: AstroProfile | None) -> bool:
    if astro is None or astro.chart_status != AstroProfile.ChartStatus.READY:
        return False
    if not (astro.sun_sign and astro.moon_sign):
        return False
    if astro.birth_time_unknown:
        return True
    return bool(astro.rising_sign)


def serialize_friend_zodiac_row(*, user, profile, astro: AstroProfile) -> dict[str, Any]:
    nc = astro.natal_chart or {}
    nickname = (
        (getattr(profile, "display_name", None) or "").strip()
        or (user.email.split("@")[0] if user.email and "@" in user.email else user.email)
    )
    trimmed = trim_natal_chart_for_friends(nc, birth_time_unknown=astro.birth_time_unknown)
    return {
        "id": user.id,
        "nickname": nickname.strip(),
        "avatar_url": (getattr(profile, "avatar_url", None) or "") or "",
        "sun_sign": astro.sun_sign,
        "moon_sign": astro.moon_sign,
        "rising_sign": astro.rising_sign or None,
        "natal_chart": trimmed,
    }
