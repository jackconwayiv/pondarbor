"""Helpers for friend-visible zodiac summaries."""

from __future__ import annotations

from typing import Any

from zodiac.models import AstroProfile

PLACEMENT_POINT_KEYS = ("sun", "moon", "mercury", "venus", "mars")


def trim_natal_chart_for_friends(natal_chart: dict[str, Any] | None) -> dict[str, Any] | None:
    if not natal_chart:
        return None
    points = natal_chart.get("points") or {}
    angles = natal_chart.get("angles") or {}
    trimmed_points = {k: points[k] for k in PLACEMENT_POINT_KEYS if k in points}
    trimmed_angles = {}
    if "ascendant" in angles:
        trimmed_angles["ascendant"] = angles["ascendant"]
    return {"points": trimmed_points, "angles": trimmed_angles}


def friend_has_shareable_zodiac(astro: AstroProfile | None) -> bool:
    if astro is None or astro.chart_status != AstroProfile.ChartStatus.READY:
        return False
    if not (astro.sun_sign and astro.moon_sign and astro.rising_sign):
        return False
    points = (astro.natal_chart or {}).get("points") or {}
    for key in ("mercury", "venus", "mars"):
        sign = (points.get(key) or {}).get("sign")
        if not sign or not str(sign).strip():
            return False
    return True


def serialize_friend_zodiac_row(*, user, profile, astro: AstroProfile) -> dict[str, Any]:
    nc = astro.natal_chart or {}
    points = nc.get("points") or {}
    nickname = (
        (getattr(profile, "display_name", None) or "").strip()
        or (user.email.split("@")[0] if user.email and "@" in user.email else user.email)
    )
    return {
        "id": user.id,
        "nickname": nickname.strip(),
        "avatar_url": (getattr(profile, "avatar_url", None) or "") or "",
        "sun_sign": astro.sun_sign,
        "moon_sign": astro.moon_sign,
        "rising_sign": astro.rising_sign,
        "mercury_sign": (points.get("mercury") or {}).get("sign"),
        "venus_sign": (points.get("venus") or {}).get("sign"),
        "mars_sign": (points.get("mars") or {}).get("sign"),
        "natal_chart": trim_natal_chart_for_friends(nc),
    }
