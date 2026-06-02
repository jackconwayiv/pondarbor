"""Input normalization and bounds for Goal-Getter write APIs."""

from __future__ import annotations

from rest_framework import serializers

MAX_GOAL_TITLE_LEN = 255
MAX_GOAL_DESCRIPTION_LEN = 2000
MAX_CHECKPOINT_TITLE_LEN = 255
MAX_CHECKPOINTS_PER_GOAL = 100
MIN_FREQUENCY_COUNT = 1
MAX_FREQUENCY_COUNT = 99


def strip_bounded_text(value: object, *, max_len: int, field: str = "value") -> str:
    if not isinstance(value, str):
        raise serializers.ValidationError({field: "Expected a string."})
    text = value.strip()
    if len(text) > max_len:
        raise serializers.ValidationError({field: f"Must be at most {max_len} characters."})
    return text


def normalize_required_title(value: object, *, field: str = "title") -> str:
    text = strip_bounded_text(value, max_len=MAX_GOAL_TITLE_LEN, field=field)
    if not text:
        raise serializers.ValidationError({field: "Title cannot be empty."})
    return text


def normalize_optional_description(value: object) -> str:
    if value is None:
        return ""
    return strip_bounded_text(value, max_len=MAX_GOAL_DESCRIPTION_LEN, field="description")


def normalize_frequency_count(value: object) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError(
            {"frequency_count": "Must be an integer."}
        ) from exc
    if n < MIN_FREQUENCY_COUNT or n > MAX_FREQUENCY_COUNT:
        raise serializers.ValidationError(
            {
                "frequency_count": (
                    f"Must be between {MIN_FREQUENCY_COUNT} and {MAX_FREQUENCY_COUNT}."
                )
            }
        )
    return n


def validate_choice(value: object, *, field: str, choices: set[str]) -> str:
    if not isinstance(value, str):
        raise serializers.ValidationError({field: "Invalid value."})
    if value not in choices:
        raise serializers.ValidationError({field: "Invalid value."})
    return value
