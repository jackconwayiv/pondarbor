"""Physical combat formulas: hit, dodge, crit, damage, mitigation."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Literal

from qff.game_helpers import (
    _equipped_items,
    modified_stats,
    roll_d100,
    total_armor_from_equipment,
)
from qff.models import Character, MonsterInstance, MonsterTemplate


Outcome = Literal["miss", "dodge", "hit", "crit"]


@dataclass
class StrikeResult:
    outcome: Outcome
    damage: int
    base_damage: int
    damage_after_mitigation: int
    was_crit: bool
    hit_chance: int
    effective_dodge_chance: int
    crit_chance: float


def clamp_hit_chance(hit_chance: int) -> int:
    return max(5, min(95, int(hit_chance)))


def compute_hit_chance(atk_moves: int, weapon_accuracy: int, def_moves: int) -> int:
    raw = 75 + (atk_moves // 2) + int(weapon_accuracy) - (def_moves // 2)
    return clamp_hit_chance(raw)


def compute_dodge_chance(def_moves: int, dodge_bonus: int) -> int:
    return max(1, (int(def_moves) // 20) + int(dodge_bonus))


def compute_effective_dodge_chance(
    dodge_chance: int, dodge_reduction: int, dodge_ignore: int
) -> int:
    return max(1, int(dodge_chance) - int(dodge_reduction) - int(dodge_ignore))


def compute_crit_chance(sense: int, level: int, total_crit_bonus_pct: int) -> float:
    return (0.001 * int(sense)) + (0.001 * int(level)) + (int(total_crit_bonus_pct) / 100.0)


def level_factor(level: int) -> float:
    lv = max(1, int(level))
    return 1.0 + 2.0 * (lv - 1) / 98.0


def compute_base_damage(weapon: int, gains: int, level: int) -> int:
    w, g, lv = int(weapon), int(gains), max(1, int(level))
    return int(math.floor((3 * w + 2 * g) * level_factor(lv)))


def compute_crit_multiplier(level: int, item_crit_damage: float) -> float:
    lv = max(1, int(level))
    return 1.5 + 0.002 * (lv - 1) + float(item_crit_damage)


def compute_crit_damage(base_damage: int, crit_multiplier: float) -> int:
    return int(math.floor(int(base_damage) * float(crit_multiplier)))


def compute_damage_reduction(armor: int, penetration: int) -> float:
    a, p = int(armor), int(penetration)
    if a <= 0:
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
        return 0
    return int(inst.item.damage or 0)


def hero_attacker_stats(character: Character) -> dict:
    mods = modified_stats(character)
    b = sum_equipped_combat_bonuses(character)
    return {
        "atk_moves": int(mods["moves"]),
        "weapon_accuracy": b["weapon_accuracy"],
        "weapon": main_hand_weapon_damage(character),
        "gains": int(mods["gains"]),
        "level": int(character.level),
        "sense": int(mods["sense"]),
        "crit_chance_bonus_pct": b["crit_chance_bonus_pct"],
        "crit_damage_bonus": b["crit_damage_bonus"],
        "penetration": b["penetration"],
        "dodge_reduction": b["dodge_reduction"],
        "dodge_ignore": b["dodge_ignore"],
    }


def hero_defender_stats(character: Character) -> dict:
    mods = modified_stats(character)
    b = sum_equipped_combat_bonuses(character)
    return {
        "def_moves": int(mods["moves"]),
        "dodge_bonus": b["dodge_bonus"],
        "armor": total_armor_from_equipment(character),
    }


def monster_defender_stats(monster: MonsterInstance) -> dict:
    tpl = monster.template
    return {
        "def_moves": int(tpl.moves or 0),
        "dodge_bonus": 0,
        "armor": int(tpl.armor or 0),
    }


def monster_attacker_stats(template: MonsterTemplate) -> dict:
    weapon = int(round((int(template.damage_min) + int(template.damage_max)) / 2))
    return {
        "atk_moves": int(template.moves or 0),
        "weapon_accuracy": int(template.accuracy or 0),
        "weapon": weapon,
        "gains": max(1, int(template.level)),
        "level": int(template.level),
        "sense": 0,
        "crit_chance_bonus_pct": 0,
        "crit_damage_bonus": 0.0,
        "penetration": 0,
        "dodge_reduction": 0,
        "dodge_ignore": 0,
    }


def resolve_physical_strike(attacker: dict, defender: dict) -> StrikeResult:
    """Roll hit → dodge → crit; apply mitigation. Uses global RNG."""
    hit_chance = compute_hit_chance(
        attacker["atk_moves"],
        attacker["weapon_accuracy"],
        defender["def_moves"],
    )
    dodge_ch = compute_dodge_chance(defender["def_moves"], defender["dodge_bonus"])
    eff_dodge = compute_effective_dodge_chance(
        dodge_ch,
        attacker["dodge_reduction"],
        attacker["dodge_ignore"],
    )
    if roll_d100() > hit_chance:
        return StrikeResult(
            outcome="miss",
            damage=0,
            base_damage=0,
            damage_after_mitigation=0,
            was_crit=False,
            hit_chance=hit_chance,
            effective_dodge_chance=eff_dodge,
            crit_chance=0.0,
        )

    if roll_d100() <= eff_dodge:
        return StrikeResult(
            outcome="dodge",
            damage=0,
            base_damage=0,
            damage_after_mitigation=0,
            was_crit=False,
            hit_chance=hit_chance,
            effective_dodge_chance=eff_dodge,
            crit_chance=0.0,
        )

    crit_ch = compute_crit_chance(
        attacker["sense"],
        attacker["level"],
        attacker["crit_chance_bonus_pct"],
    )
    crit_ch = min(0.95, max(0.0, crit_ch))

    base = compute_base_damage(
        attacker["weapon"], attacker["gains"], attacker["level"]
    )
    crit_mult = compute_crit_multiplier(
        attacker["level"], attacker["crit_damage_bonus"]
    )
    crit_raw = compute_crit_damage(base, crit_mult)

    was_crit = random.random() < crit_ch
    raw = crit_raw if was_crit else base
    dr = compute_damage_reduction(defender["armor"], attacker["penetration"])
    final = compute_final_damage(raw, dr)
    outcome: Outcome = "crit" if was_crit else "hit"
    return StrikeResult(
        outcome=outcome,
        damage=final,
        base_damage=base,
        damage_after_mitigation=final,
        was_crit=was_crit,
        hit_chance=hit_chance,
        effective_dodge_chance=eff_dodge,
        crit_chance=crit_ch,
    )
