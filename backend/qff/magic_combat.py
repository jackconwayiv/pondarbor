"""Magic / spell combat (stub).

Physical strikes use [`qff.combat_math.resolve_physical_strike`]. When spells ship,
add `resolve_magic_strike` with its own scaling (e.g. Smarts) and damage type,
and wire `/cast` (or similar) here. The `buy abilities` command stays a placeholder
until then (see `_handle_buy_abilities`).
"""

from __future__ import annotations

from qff.combat_math import StrikeResult, resolve_physical_strike


def resolve_magic_strike(attacker: dict, defender: dict) -> StrikeResult:
    """Placeholder: reuse physical resolution until a dedicated magic pipeline exists."""
    return resolve_physical_strike(attacker, defender)
