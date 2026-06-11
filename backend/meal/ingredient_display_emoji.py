"""Optional per-ingredient emoji override for pantry cards."""

from __future__ import annotations

from rest_framework.exceptions import ValidationError

MAX_DISPLAY_EMOJI_LEN = 32


def normalize_display_emoji(raw: object) -> str:
    """Return stripped emoji string or empty (use category default). Rejects plain text."""
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    if len(s) > MAX_DISPLAY_EMOJI_LEN:
        raise ValidationError(
            {"display_emoji": f"Must be at most {MAX_DISPLAY_EMOJI_LEN} characters."},
        )
    for ch in s:
        if ch.isascii() and (ch.isalnum() or ch in "._-"):
            raise ValidationError({"display_emoji": "Enter an emoji, not plain text."})
    return s
