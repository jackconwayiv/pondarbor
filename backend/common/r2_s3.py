"""Shared Cloudflare R2 (S3 API) config and boto3 client for Closet, Meal, etc."""

from __future__ import annotations

import os

from django.conf import settings


def r2_bucket_config_from_env() -> dict | None:
    """
    Returns bucket config dict or None if R2 is not configured.
    Uses the same env vars as Closet uploads.
    """
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    endpoint_override = getattr(settings, "CLOSET_R2_S3_ENDPOINT_URL", "") or ""
    bucket = os.getenv("CLOSET_R2_BUCKET", "").strip()
    access_key = os.getenv("CLOSET_R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("CLOSET_R2_SECRET_ACCESS_KEY", "").strip()
    has_endpoint = bool(endpoint_override) or bool(account_id)
    if not all([has_endpoint, bucket, access_key, secret_key]):
        return None
    if endpoint_override:
        endpoint_url = endpoint_override if "://" in endpoint_override else f"https://{endpoint_override}"
    else:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    return {
        "bucket": bucket,
        "endpoint_url": endpoint_url,
        "access_key": access_key,
        "secret_key": secret_key,
    }


def build_r2_s3_client(config: dict):
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "boto3 is not installed. Install backend requirements (boto3).",
        ) from exc

    extra_kwargs = {}
    if os.getenv("CLOSET_R2_S3_PATH_STYLE", "0").lower() in ("1", "true", "yes"):
        from botocore.client import Config

        extra_kwargs["config"] = Config(signature_version="s3v4", s3={"addressing_style": "path"})

    return boto3.client(
        "s3",
        endpoint_url=config["endpoint_url"],
        aws_access_key_id=config["access_key"],
        aws_secret_access_key=config["secret_key"],
        region_name="auto",
        **extra_kwargs,
    )
