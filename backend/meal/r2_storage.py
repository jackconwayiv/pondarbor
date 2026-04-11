"""Meal recipe images on the same Cloudflare R2 bucket as Closet (distinct key prefix)."""

from __future__ import annotations

import logging
import os
import uuid
from typing import TYPE_CHECKING

from django.conf import settings
from django.utils import timezone

from common.r2_s3 import build_r2_s3_client, r2_bucket_config_from_env
from closet.serializers import closet_image_key_owned_by_user, closet_item_image_url

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def meal_r2_root_parts() -> list[str]:
    prefix = getattr(settings, "MEAL_R2_KEY_PREFIX", "meal") or "meal"
    prefix = str(prefix).strip().strip("/") or "meal"
    return [p for p in prefix.split("/") if p]


def expected_meal_image_key_prefix(user_id: int) -> str:
    root = "/".join(meal_r2_root_parts())
    return f"{root}/{user_id}/"


def meal_image_key_owned_by_user(image_key: str, user_id: int) -> bool:
    raw = (image_key or "").strip().strip("/")
    if not raw:
        return False
    parts = [p for p in raw.split("/") if p]
    root = meal_r2_root_parts()
    if len(parts) < len(root) + 1:
        return False
    if parts[: len(root)] != root:
        return False
    return parts[len(root)] == str(user_id)


def meal_image_public_url(image_key: str) -> str:
    return closet_item_image_url(image_key)


def validate_meal_image_key_for_user(value, user) -> str:
    from rest_framework import serializers

    raw = "" if value is None else str(value).strip()
    if not raw:
        return ""
    if not user or not user.is_authenticated:
        raise serializers.ValidationError("Authentication required.")
    uid = user.id
    if not (
        meal_image_key_owned_by_user(raw, uid) or closet_image_key_owned_by_user(raw, uid)
    ):
        raise serializers.ValidationError(
            "Image key must be a Closet or Meal Maestro upload for your account.",
        )
    return raw


def upload_meal_image_bytes(*, user_id: int, data: bytes, label: str = "import") -> str:
    """
    Store raw image bytes in R2 under meal/{prefix}/... Returns object key.
    Raises RuntimeError if R2 unavailable or upload fails.
    """
    max_bytes = _env_int("MEAL_IMAGE_MAX_BYTES", 2 * 1024 * 1024)
    if len(data) > max_bytes:
        raise ValueError(f"Image exceeds maximum size ({max_bytes} bytes).")

    ext, content_type = _detect_image_type(data)
    config = r2_bucket_config_from_env()
    if not config:
        raise RuntimeError("R2 is not configured.")

    root = "/".join(meal_r2_root_parts())
    key = f"{root}/{user_id}/{timezone.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}-{label}.{ext}"
    client = build_r2_s3_client(config)
    try:
        client.put_object(
            Bucket=config["bucket"],
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except Exception:
        logger.exception("meal R2 put_object failed for key=%s", key)
        raise
    return key


def _detect_image_type(data: bytes) -> tuple[str, str]:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    raise ValueError("Unsupported image format (use JPEG, PNG, or WebP).")
