"""Canonical food-group category for owner-scoped ingredients."""

from __future__ import annotations

from rest_framework.exceptions import ValidationError

FOOD_GROUP_PRESETS: tuple[str, ...] = (
    "Bread",
    "Starch",
    "Vegetables",
    "Fruit",
    "Meat",
    "Protein",
    "Dairy",
    "Seafood",
    "Pantry staple",
    "Condiment",
    "Beverage",
)


def normalize_food_group(raw: object) -> str:
    """Return canonical preset label or empty string. Rejects unknown values."""
    if raw is None:
        return ""
    s = str(raw).strip()[:64]
    if not s:
        return ""
    fold = s.casefold()
    for preset in FOOD_GROUP_PRESETS:
        if preset.casefold() == fold:
            return preset
    raise ValidationError(
        {"food_group": f"Unknown food group. Choose from: {', '.join(FOOD_GROUP_PRESETS)}"},
    )
