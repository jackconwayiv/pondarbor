"""Serialization and birth-data helpers for astro profiles."""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from typing import Any

from zodiac.models import AstroProfile


def coerce_birth_fields(fields: dict[str, Any]) -> dict[str, Any]:
    """Normalize JSON types to DB types."""
    out = dict(fields)
    if "birth_date" in out and isinstance(out["birth_date"], str):
        out["birth_date"] = date.fromisoformat(out["birth_date"])
    if "birth_time" in out:
        bt = out["birth_time"]
        if bt is None:
            out["birth_time"] = None
        elif isinstance(bt, str):
            ts = bt.strip()
            if not ts:
                out["birth_time"] = None
            else:
                if len(ts) == 5 and ts[2] == ":":
                    ts = ts + ":00"
                out["birth_time"] = time.fromisoformat(ts)
    if "latitude" in out and out["latitude"] is not None:
        out["latitude"] = Decimal(str(out["latitude"]))
    if "longitude" in out and out["longitude"] is not None:
        out["longitude"] = Decimal(str(out["longitude"]))
    return out


def birth_key_from_model(profile: AstroProfile) -> tuple:
    return (
        str(profile.birth_date) if profile.birth_date else None,
        profile.birth_time.isoformat() if profile.birth_time else None,
        profile.country_code or "",
        profile.admin_area or "",
        profile.locality or "",
        profile.postal_code or "",
        str(profile.latitude) if profile.latitude is not None else "",
        str(profile.longitude) if profile.longitude is not None else "",
        profile.iana_timezone or "",
    )


def parse_birth_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Extract and normalize birth fields from JSON body."""
    out: dict[str, Any] = {}
    if "birth_date" in data and data["birth_date"] is not None:
        out["birth_date"] = data["birth_date"]
    if "birth_time" in data:
        out["birth_time"] = data["birth_time"]
    for key in (
        "country_code",
        "admin_area",
        "locality",
        "postal_code",
        "latitude",
        "longitude",
        "iana_timezone",
    ):
        if key in data:
            out[key] = data[key]
    return out


def apply_birth_payload(profile: AstroProfile, fields: dict[str, Any]) -> None:
    if "birth_date" in fields:
        profile.birth_date = fields["birth_date"]
    if "birth_time" in fields:
        profile.birth_time = fields.get("birth_time")
    if "country_code" in fields and fields["country_code"]:
        profile.country_code = str(fields["country_code"])[:2].upper()
    if "admin_area" in fields:
        profile.admin_area = (fields["admin_area"] or "")[:128]
    if "locality" in fields:
        profile.locality = (fields["locality"] or "")[:256]
    if "postal_code" in fields:
        profile.postal_code = (fields["postal_code"] or "")[:32]
    if "latitude" in fields:
        v = fields["latitude"]
        profile.latitude = Decimal(str(v)) if v is not None else None
    if "longitude" in fields:
        v = fields["longitude"]
        profile.longitude = Decimal(str(v)) if v is not None else None
    if "iana_timezone" in fields:
        profile.iana_timezone = (fields["iana_timezone"] or "")[:64]


def serialize_astro_profile(profile: AstroProfile) -> dict[str, Any]:
    nc = profile.natal_chart
    return {
        "chart_status": profile.chart_status,
        "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
        "birth_time": profile.birth_time.isoformat() if profile.birth_time else None,
        "country_code": profile.country_code,
        "admin_area": profile.admin_area,
        "locality": profile.locality,
        "postal_code": profile.postal_code,
        "latitude": float(profile.latitude) if profile.latitude is not None else None,
        "longitude": float(profile.longitude) if profile.longitude is not None else None,
        "iana_timezone": profile.iana_timezone,
        "natal_chart": nc,
        "sun_sign": profile.sun_sign or None,
        "moon_sign": profile.moon_sign or None,
        "rising_sign": profile.rising_sign or None,
        "birth_time_unknown": profile.birth_time_unknown,
        "waiting_submitted_at": profile.waiting_submitted_at.isoformat()
        if profile.waiting_submitted_at
        else None,
        "chart_ready_at": profile.chart_ready_at.isoformat()
        if profile.chart_ready_at
        else None,
    }


def signs_from_natal_chart(
    natal_chart: dict, *, birth_time_unknown: bool = False
) -> tuple[str, str, str]:
    """Derive sun, moon, rising signs from parsed chart."""
    sun = natal_chart["points"]["sun"]["sign"]
    moon = natal_chart["points"]["moon"]["sign"]
    if birth_time_unknown:
        return sun, moon, ""
    rising = natal_chart["angles"]["ascendant"]["sign"]
    return sun, moon, rising
