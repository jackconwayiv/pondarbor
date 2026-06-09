"""Resolve profile avatar URLs (R2 presigned GET or external URL)."""

from __future__ import annotations

from django.conf import settings

from common.r2_s3 import r2_presigned_get_url


def _legacy_public_base() -> str:
    return (getattr(settings, "CLOSET_R2_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")


def avatar_image_key_from_legacy_url(url: str) -> str:
    """Extract R2 object key from a stored public CDN URL, or '' if not a legacy R2 URL."""
    raw = (url or "").strip()
    if not raw:
        return ""
    base = _legacy_public_base()
    if base and raw.startswith(base + "/"):
        return raw[len(base) + 1 :].lstrip("/")
    return ""


def profile_avatar_image_key(profile) -> str:
    key = (getattr(profile, "avatar_image_key", None) or "").strip()
    if key:
        return key
    return avatar_image_key_from_legacy_url(getattr(profile, "avatar_url", "") or "")


def profile_avatar_url(profile) -> str:
    key = profile_avatar_image_key(profile)
    if key:
        presigned = r2_presigned_get_url(key)
        if presigned:
            return presigned
    return (getattr(profile, "avatar_url", None) or "").strip()
