"""XP progression helpers for trainer thresholds and kill rewards."""

from __future__ import annotations


def base_xp(level: int) -> int:
    """Guideline baseline for progression tuning (not per-monster runtime XP)."""
    lv = max(1, int(level))
    return 2 * lv * lv + 8


def kills_to_level(level: int) -> int:
    """On-level kill bands: 1-4 => 7, 5-8 => 8, etc."""
    lv = max(1, int(level))
    return 7 + (lv - 1) // 4


def xp_to_next(level: int) -> int:
    lv = max(1, int(level))
    return base_xp(lv) * kills_to_level(lv)


def xp_modifier(player_level: int, monster_level: int) -> float:
    """Lower-level monster diminishing returns with staged floors."""
    plv = max(1, int(player_level))
    mlv = max(1, int(monster_level))
    gap = plv - mlv
    if gap <= 0:
        return 1.00
    if gap == 1:
        return max(0.80, 1.00 - 0.05 * (plv - 2))
    if gap == 2:
        return max(0.60, 0.80 - 0.05 * (plv - 3))
    if gap == 3:
        return max(0.40, 0.60 - 0.05 * (plv - 4))
    if gap == 4:
        return max(0.20, 0.40 - 0.05 * (plv - 5))
    return max(0.00, 0.20 - 0.05 * (plv - 6))


def actual_xp(player_level: int, monster_level: int, monster_xp_value: int) -> int:
    base_value = max(0, int(monster_xp_value))
    return round(base_value * xp_modifier(player_level, monster_level))
