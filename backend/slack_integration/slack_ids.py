"""Normalize Slack channel IDs from env vars, URLs, and Events API payloads."""

from __future__ import annotations

import re

_CHANNEL_ID_RE = re.compile(r"[CGD][A-Z0-9]{8,}")


def normalize_slack_channel_id(raw: str | None) -> str:
    s = (raw or "").strip().strip('"').strip("'")
    s = s.replace("\u200b", "").replace("\ufeff", "")
    if not s:
        return ""
    m = _CHANNEL_ID_RE.search(s.upper())
    return m.group(0) if m else s
