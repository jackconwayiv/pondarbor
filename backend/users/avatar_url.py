"""Resolve profile avatar URLs (R2 presigned GET or external URL)."""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from rest_framework.authentication import get_authorization_header

from common.r2_s3 import r2_presigned_get_url

logger = logging.getLogger(__name__)


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


def _avatar_url_max_length() -> int:
    from users.models import Profile

    return Profile._meta.get_field("avatar_url").max_length


def _clip_avatar_url(url: str) -> str:
    max_len = _avatar_url_max_length()
    if not url or max_len <= 0:
        return url
    return url if len(url) <= max_len else url[:max_len]


def restore_idp_avatar_url_if_empty(profile, *, picture: str) -> bool:
    """Restore IdP picture into avatar_url when no custom avatar or external URL is set."""
    if (getattr(profile, "avatar_image_key", None) or "").strip():
        return False
    if (getattr(profile, "avatar_url", None) or "").strip():
        return False
    pic = _clip_avatar_url((picture or "").strip())
    if not pic:
        return False
    profile.avatar_url = pic
    profile.save(update_fields=["avatar_url"])
    return True


def _bearer_token_from_request(request) -> str:
    auth = get_authorization_header(request).split()
    if len(auth) != 2 or auth[0].lower() != b"bearer":
        return ""
    return auth[1].decode("utf-8")


def idp_picture_for_request(request) -> str:
    """Picture URL from Auth0 JWT payload, or /userinfo when absent from the access token."""
    auth = getattr(request, "auth", None)
    payload = auth.get("payload") if isinstance(auth, dict) else {}
    if not isinstance(payload, dict):
        payload = {}
    picture = (payload.get("picture") or "").strip()
    if picture:
        return picture

    token = _bearer_token_from_request(request)
    if not token or not getattr(settings, "AUTH0_DOMAIN", None):
        return ""

    try:
        userinfo_response = requests.get(
            f"https://{settings.AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        userinfo_response.raise_for_status()
        userinfo = userinfo_response.json()
        if isinstance(userinfo, dict):
            return (userinfo.get("picture") or "").strip()
    except requests.RequestException:
        logger.debug("idp_picture_for_request: /userinfo lookup failed", exc_info=True)
    except (TypeError, ValueError):
        logger.debug("idp_picture_for_request: invalid /userinfo response", exc_info=True)
    return ""
