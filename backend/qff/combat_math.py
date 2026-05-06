"""Physical combat formulas: hit, crit, damage, mitigation.

Pipeline (``resolve_physical_strike``), same order as rolls occur:

1. Roll hit: ``roll_d100()`` vs ``HitChance`` — if ``roll > HitChance``, **miss** (stop).
2. If hit: roll crit: ``random.random()`` vs ``CritChance`` — if below threshold, use crit damage branch.
4. **PaperBase** — heroes with a weapon (main hand ``damage > 0``): ``floor((3×Weapon + 2×Gains) × LevelFactor)`` with ``LevelFactor = 1 + 2×(Level−1)/98``. **Unarmed** heroes (no main-hand item or ``damage <= 0``): ``1 + Level`` (ignores gains and the weapon formula). Monsters: caller rolls ``UniformInteger[damage_min, damage_max]`` inclusive and passes it as ``flat_base_damage`` (that value is the monster’s paper base for the strike).
5. **RolledBase** = ``max(1, PaperBase + U)`` where ``U ~ Uniform{−L,…,L}`` and ``L = max(1, AttackerLevel)`` (hero level or ``MonsterTemplate.level``). For monsters, ``RolledBase`` can be **above** ``damage_max`` (e.g. paper 3 and ``U = +1`` at level 1 → 4) or below ``damage_min`` only down to the global floor 1.
6. **CritDamage** = ``floor(CritRolledBase × CritMultiplier)``.
7. **DamageReduction** = ``EffectiveArmor / (EffectiveArmor + MitigationScale)`` with ``MitigationScale = 100 + 2×Penetration``; if ``EffectiveArmor <= 0``, reduction is 0.
8. **Final** = ``max(1, floor(chosen × (1 − DamageReduction)))`` where ``chosen`` is ``RolledBase`` or ``CritDamage``.

On a critical hit, base swing damage is rolled twice and the higher roll is used as
``CritRolledBase`` before applying crit multiplier and mitigation.

Formulas (integer ``//`` where the spec uses floor for moves):

- ``HitChance = clamp(Base + AccuracyModifier − DodgeModifier, 5, 95)``
  - ``Base`` is **75**, or **50** when the hero attacks from an unlit dark area (no torch,
    sconce area unlock, or permanent room light).
  - ``AccuracyModifier = WeaponAccuracy + 0.25 × AccuracyBudget(Level) × min(1, AtkMoves / MovesScale(Level))``
  - ``DodgeTotal = DodgeBonus + 0.75 × DodgeBudget(Level) × min(1, DefMoves / MovesScale(Level))``
  - ``DodgeModifier = 0`` if attacker has dodge-ignore active; else ``DodgeTotal × (1 − DodgeReductionPct/100)``.
- ``CritChance`` and ``CritMultiplier`` follow the piecewise caps in the combat spec.

**Note:** An unarmed level‑1 hero has **paper** base ``1 + 1 = 2``; with ``L = 1`` each hit uses ``RolledBase`` in ``{1,2,3}`` before armor. Higher levels use a wider ``±L`` band on that same unarmed paper base.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Literal

from qff.constants import UNARMED_WEAPON_RATING
from qff.game_helpers import (
    _equipped_items,
    encumbrance_excess,
    modified_stats,
    roll_d100,
    total_armor_from_equipment,
)
from qff.models import Character, MonsterInstance, MonsterTemplate
from qff.narrative_visibility import sconce_lit_area_ids_for_character


Outcome = Literal["miss", "hit", "crit"]


@dataclass
class StrikeResult:
    outcome: Outcome
    damage: int
    base_damage: int  # paper base before ±L swing
    damage_after_mitigation: int
    was_crit: bool
    hit_chance: int
    crit_chance: float
    rolled_base: int = 0  # after swing, before crit/mitigation; 0 on miss


def clamp_hit_chance(hit_chance: int) -> int:
    return max(5, min(95, int(hit_chance)))


def moves_scale(level: int) -> float:
    lv = max(1, int(level))
    if lv <= 25:
        # 1 + (49/24) * (Level - 1)
        return 1.0 + (49.0 / 24.0) * (lv - 1)
    if lv <= 50:
        # 2 * Level
        return 2.0 * lv
    # 4 * Level - 100
    return 4.0 * lv - 100.0


def accuracy_budget(level: int) -> float:
    lv = max(1, int(level))
    if lv <= 25:
        return 5.0 * (lv - 1) / 24.0
    if lv <= 50:
        return 5.0 + 5.0 * (lv - 25) / 25.0
    if lv <= 75:
        return 10.0 + 5.0 * (lv - 50) / 25.0
    return 15.0 + 5.0 * (lv - 75) / 25.0


def dodge_budget(level: int) -> float:
    lv = max(1, int(level))
    if lv <= 25:
        return 10.0 * (lv - 1) / 24.0
    if lv <= 50:
        return 10.0 + 5.0 * (lv - 25) / 25.0
    if lv <= 75:
        return 15.0 + 5.0 * (lv - 50) / 25.0
    return 20.0 + 5.0 * (lv - 75) / 25.0


def _moves_ratio(moves: int, level: int) -> float:
    ms = moves_scale(level)
    if ms <= 0:
        return 0.0
    return min(1.0, max(0.0, float(int(moves)) / ms))


def compute_accuracy_modifier(atk_moves: int, weapon_accuracy: int, atk_level: int) -> float:
    r = _moves_ratio(atk_moves, atk_level)
    return float(int(weapon_accuracy)) + 0.25 * accuracy_budget(atk_level) * r


def compute_dodge_total(def_moves: int, dodge_bonus: int, def_level: int) -> float:
    r = _moves_ratio(def_moves, def_level)
    return float(int(dodge_bonus)) + 0.75 * dodge_budget(def_level) * r


def compute_dodge_modifier(
    dodge_total: float, dodge_reduction_pct: int, dodge_ignore_active: bool
) -> float:
    if dodge_ignore_active:
        return 0.0
    pct = max(0, min(100, int(dodge_reduction_pct)))
    return max(0.0, float(dodge_total) * (1.0 - pct / 100.0))


def compute_hit_chance(
    atk_moves: int,
    weapon_accuracy: int,
    def_moves: int,
    *,
    atk_level: int,
    def_level: int,
    dodge_bonus: int,
    dodge_reduction_pct: int,
    dodge_ignore_active: bool,
    base: int = 75,
) -> int:
    acc = compute_accuracy_modifier(atk_moves, weapon_accuracy, atk_level)
    dodge_total = compute_dodge_total(def_moves, dodge_bonus, def_level)
    dodge = compute_dodge_modifier(dodge_total, dodge_reduction_pct, dodge_ignore_active)
    raw = float(base) + acc - dodge
    # d100 to-hit is an integer percent in [5, 95]. Keep internal float math, clamp into the
    # allowed band, then discretize with floor (not floor-then-clamp) so tiny sub-integer
    # differences don't get stuck one point below a cap.
    band = min(95.0, max(5.0, float(raw)))
    return int(math.floor(band))


def hero_unlit_dark_area_for_combat(character: Character) -> bool:
    """True when the hero's attack uses the lower hit base (50): dark area without usable light."""
    room = character.current_room
    if room is None:
        return False
    area = room.area
    if not area.is_dark_minimap:
        return False
    if int(area.id) in sconce_lit_area_ids_for_character(character):
        return False
    if getattr(room, "permanent_minimap_light", False):
        return False
    tr = getattr(character, "dark_minimap_torch_radius", None)
    if tr is not None and int(tr) > 0:
        return False
    return True


def hero_hit_chance_base(character: Character) -> int:
    """75 normally; 50 in an unlit dark area (see ``hero_unlit_dark_area_for_combat``)."""
    return 50 if hero_unlit_dark_area_for_combat(character) else 75


def compute_crit_chance(sense: int, level: int, total_crit_bonus_pct: int) -> float:
    """Piecewise-capped crit curve vs stat term; bonus is percentage points (5 = +0.05).

    Result is a probability; callers may cap at 1.0 for RNG rolls, but are not
    hard-limited to 95% (100% crit builds are allowed when bonuses push past the cap)."""
    lv = max(1, int(level))
    if lv <= 50:
        cap = 0.01 + (0.24 / 49.0) * (lv - 1)
    elif lv <= 75:
        cap = 0.25 + 0.01 * (lv - 50)
    else:
        cap = 0.50 + 0.02 * (lv - 75)
    stat = (int(sense) / 1200.0) + (lv / 2000.0) + (int(total_crit_bonus_pct) / 100.0)
    return min(cap, stat)


def level_factor(level: int) -> float:
    lv = max(1, int(level))
    return 1.0 + 2.0 * (lv - 1) / 98.0


def compute_base_damage(weapon: int, gains: int, level: int) -> int:
    w, g, lv = int(weapon), int(gains), max(1, int(level))
    return int(math.floor((3 * w + 2 * g) * level_factor(lv)))


def compute_unarmed_paper_base(level: int) -> int:
    """Paper base for hero unarmed strikes: ``1 + level`` (no gains/weapon stat mix-in)."""
    lv = max(1, int(level))
    return 1 + lv


def compute_crit_multiplier(level: int, item_crit_damage_bonus_pct: float) -> float:
    lv = max(1, int(level))
    if lv <= 50:
        cap = 1.5 + (0.5 / 49.0) * (lv - 1)
    elif lv <= 75:
        cap = 2.0 + 0.02 * (lv - 50)
    else:
        cap = 2.5 + 0.02 * (lv - 75)
    # item_crit_damage_bonus_pct is stored in percentage points (10 => +0.10 multiplier).
    stat = 1.5 + 0.0025 * (lv - 1) + (float(item_crit_damage_bonus_pct) / 100.0)
    return min(cap, stat)


def compute_crit_damage(base_damage: int, crit_multiplier: float) -> int:
    return int(math.floor(int(base_damage) * float(crit_multiplier)))


def apply_damage_swing(paper_base: int, attacker_level: int) -> int:
    """``max(1, paper_base + U)`` with ``U`` uniform on ``[-L, L]``, ``L = max(1, attacker_level)``."""
    L = max(1, int(attacker_level))
    pb = int(paper_base)
    return max(1, pb + random.randint(-L, L))


def compute_damage_reduction(effective_armor: float, penetration: int) -> float:
    a, p = float(effective_armor), int(penetration)
    if a <= 0.0:
        return 0.0
    scale = 100 + 2 * p
    return a / (a + scale)


def compute_final_damage(base_or_crit: int, damage_reduction: float) -> int:
    return max(1, int(math.floor(int(base_or_crit) * (1.0 - float(damage_reduction)))))


def sum_equipped_combat_bonuses(character: Character) -> dict:
    t = {
        "weapon_accuracy": 0,
        "crit_chance_bonus_pct": 0,
        "crit_damage_bonus": 0.0,
        "penetration": 0,
        "dodge_bonus": 0,
        "dodge_reduction": 0,
        "dodge_ignore": 0,
    }
    for inst in _equipped_items(character):
        it = inst.item
        t["weapon_accuracy"] += int(it.weapon_accuracy or 0)
        t["crit_chance_bonus_pct"] += int(it.crit_chance_bonus_pct or 0)
        t["crit_damage_bonus"] += float(it.crit_damage_bonus or 0)
        t["penetration"] += int(it.penetration or 0)
        t["dodge_bonus"] += int(it.dodge_bonus or 0)
        t["dodge_reduction"] += int(it.dodge_reduction or 0)
        t["dodge_ignore"] += int(it.dodge_ignore or 0)
    return t


def main_hand_weapon_damage(character: Character) -> int:
    inst = character.main_hand_item
    if not inst:
        return UNARMED_WEAPON_RATING
    d = int(inst.item.damage or 0)
    return UNARMED_WEAPON_RATING if d <= 0 else d


def hero_is_unarmed_for_paper_damage(character: Character) -> bool:
    """True when main hand has no item or item damage <= 0 (fists / non-weapon)."""
    inst = character.main_hand_item
    if not inst:
        return True
    return int(inst.item.damage or 0) <= 0


def hero_attacker_stats(character: Character) -> dict:
    mods = modified_stats(character)
    b = sum_equipped_combat_bonuses(character)
    enc = max(0, int(encumbrance_excess(character)))
    return {
        "atk_moves": max(1, int(mods["moves"]) - enc),
        "weapon_accuracy": b["weapon_accuracy"],
        "weapon": main_hand_weapon_damage(character),
        "gains": int(mods["gains"]),
        "level": int(character.level),
        "is_unarmed": hero_is_unarmed_for_paper_damage(character),
        "sense": int(mods["sense"]),
        "crit_chance_bonus_pct": b["crit_chance_bonus_pct"],
        "crit_damage_bonus": b["crit_damage_bonus"],
        "penetration": b["penetration"],
        # dodge_reduction is a percentage of defender DodgeTotal (clamped in compute); dodge_ignore is boolean-ish.
        "dodge_reduction_pct": b["dodge_reduction"],
        "dodge_ignore_active": b["dodge_ignore"] > 0,
        "hit_chance_base": hero_hit_chance_base(character),
    }


def hero_defender_stats(character: Character) -> dict:
    mods = modified_stats(character)
    b = sum_equipped_combat_bonuses(character)
    enc = max(0, int(encumbrance_excess(character)))
    return {
        "def_moves": max(1, int(mods["moves"]) - enc),
        "dodge_bonus": b["dodge_bonus"],
        "level": int(character.level),
        # Hero defending uses /5 effective-armor scaling.
        "effective_armor": float(total_armor_from_equipment(character)) / 5.0,
    }


def monster_defender_stats(monster: MonsterInstance) -> dict:
    tpl = monster.template
    return {
        "def_moves": int(tpl.moves or 0),
        "dodge_bonus": 0,
        "level": int(tpl.level),
        # Monster defending uses template armor literally (no /5).
        "effective_armor": float(int(tpl.armor or 0)),
    }


def monster_attacker_stats(template: MonsterTemplate) -> dict:
    return {
        "atk_moves": int(template.moves or 0),
        "weapon_accuracy": int(template.accuracy or 0),
        "weapon": 0,
        "gains": max(1, int(template.level)),
        "level": int(template.level),
        "sense": 0,
        "crit_chance_bonus_pct": int(template.crit_chance_bonus_pct or 0),
        "crit_damage_bonus": float(template.crit_damage_bonus or 0),
        "penetration": int(template.penetration or 0),
        "dodge_reduction_pct": int(template.dodge_reduction or 0),
        "dodge_ignore_active": int(template.dodge_ignore or 0) > 0,
    }


def resolve_physical_strike(
    attacker: dict, defender: dict, *, flat_base_damage: int | None = None
) -> StrikeResult:
    """Roll hit → crit; apply mitigation. Uses global RNG.

    If ``flat_base_damage`` is set (monster strikes), it **is** the paper base for
    this strike: the caller should roll it uniformly on ``[damage_min, damage_max]``
    inclusive. ``apply_damage_swing`` then adds ``±L`` on top (see module docstring).
    """
    hit_base = int(attacker.get("hit_chance_base", 75))
    hit_chance = compute_hit_chance(
        attacker["atk_moves"],
        attacker["weapon_accuracy"],
        defender["def_moves"],
        atk_level=attacker["level"],
        def_level=defender["level"],
        dodge_bonus=defender["dodge_bonus"],
        dodge_reduction_pct=attacker.get("dodge_reduction_pct", 0),
        dodge_ignore_active=bool(attacker.get("dodge_ignore_active", False)),
        base=hit_base,
    )
    if roll_d100() > hit_chance:
        return StrikeResult(
            outcome="miss",
            damage=0,
            base_damage=0,
            damage_after_mitigation=0,
            was_crit=False,
            hit_chance=hit_chance,
            crit_chance=0.0,
            rolled_base=0,
        )

    crit_ch = compute_crit_chance(
        attacker["sense"],
        attacker["level"],
        attacker["crit_chance_bonus_pct"],
    )
    p = max(0.0, float(crit_ch))
    p_roll = min(1.0, p)

    if flat_base_damage is not None:
        base = max(1, int(flat_base_damage))
    elif attacker.get("is_unarmed"):
        base = compute_unarmed_paper_base(int(attacker["level"]))
    else:
        base = compute_base_damage(
            attacker["weapon"], attacker["gains"], attacker["level"]
        )
    # random.random() is in [0, 1); use < p_roll, but p_roll==1.0 must always crit.
    was_crit = p_roll >= 1.0 or (p_roll > 0.0 and random.random() < p_roll)
    if was_crit:
        rolled = max(
            apply_damage_swing(base, int(attacker["level"])),
            apply_damage_swing(base, int(attacker["level"])),
        )
    else:
        rolled = apply_damage_swing(base, int(attacker["level"]))
    crit_mult = compute_crit_multiplier(
        attacker["level"], attacker["crit_damage_bonus"]
    )
    crit_raw = compute_crit_damage(rolled, crit_mult)
    raw = crit_raw if was_crit else rolled
    dr = compute_damage_reduction(defender["effective_armor"], attacker["penetration"])
    final = compute_final_damage(raw, dr)
    outcome: Outcome = "crit" if was_crit else "hit"
    return StrikeResult(
        outcome=outcome,
        damage=final,
        base_damage=base,
        damage_after_mitigation=final,
        was_crit=was_crit,
        hit_chance=hit_chance,
        crit_chance=p,
        rolled_base=rolled,
    )
