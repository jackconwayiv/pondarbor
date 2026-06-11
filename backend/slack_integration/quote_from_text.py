"""Parse /quote slash command text into quote body and optional attribution."""

from __future__ import annotations

import re

# Trailing " -name" or " - name" (attribution without requiring a registered user).
_ATTRIBUTION_SUFFIX = re.compile(r"^(?P<body>.+?)\s+-\s*(?P<attribution>\S.+?)\s*$")


def parse_slack_quote_command_text(text: str) -> tuple[str, str | None]:
    """
    Split Slack /quote text into (body, attribution_name).

    Example: "here's my quote -billy" -> ("here's my quote", "billy")
    """
    raw = (text or "").strip()
    if not raw:
        return "", None

    match = _ATTRIBUTION_SUFFIX.match(raw)
    if not match:
        return raw, None

    body = (match.group("body") or "").strip()
    attribution = (match.group("attribution") or "").strip()
    if not body:
        return raw, None
    if not attribution:
        return body, None
    return body, attribution
