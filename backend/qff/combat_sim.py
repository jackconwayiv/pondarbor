"""Deterministic combat math preview for DM tools (no DB models required)."""

from __future__ import annotations

import math
from typing import Any

from qff.combat_math import (
    accuracy_budget,
    compute_accuracy_modifier,
    compute_base_damage,
    compute_crit_chance,
    compute_crit_multiplier,
    compute_damage_reduction,
    compute_dodge_modifier,
    compute_dodge_total,
    compute_final_damage,
    compute_unarmed_paper_base,
    dodge_budget,
    level_factor,
    moves_scale,
)
from qff.constants import UNARMED_WEAPON_RATING as UNARMED_R

SLOT_ORDER = (
    "head",
    "main_hand",
    "off_hand",
    "chest",
    "feet",
    "ring",
    "amulet",
)

# API may send camelCase keys from frontend
_SLOT_ALIASES = {
    "mainHand": "main_hand",
    "offHand": "off_hand",
}


def _norm_slot_key(k: str) -> str:
    return _SLOT_ALIASES.get(k, k)


def _iget(d: dict[str, Any], *keys: str, default: int = 0) -> int:
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return int(d[k])
            except (TypeError, ValueError):
                pass
    return default


def _fget(d: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return float(d[k])
            except (TypeError, ValueError):
                pass
    return default


def _empty_combat_bonuses() -> dict[str, Any]:
    return {
        "weapon_accuracy": 0,
        "crit_chance_bonus_pct": 0,
        "crit_damage_bonus": 0.0,
        "penetration": 0,
        "dodge_bonus": 0,
        "dodge_reduction": 0,
        "dodge_ignore": 0,
        "armor": 0,
        "bonus_gains": 0,
        "bonus_moves": 0,
        "bonus_guts": 0,
        "bonus_smarts": 0,
        "bonus_sense": 0,
        "bonus_rizz": 0,
    }


def _sum_slot_item_dict(slot_data: dict[str, Any] | None) -> dict[str, Any]:
    if not slot_data or not isinstance(slot_data, dict):
        return _empty_combat_bonuses()
    return {
        "weapon_accuracy": _iget(slot_data, "weapon_accuracy"),
        "crit_chance_bonus_pct": _iget(slot_data, "crit_chance_bonus_pct"),
        "crit_damage_bonus": _fget(slot_data, "crit_damage_bonus"),
        "penetration": _iget(slot_data, "penetration"),
        "dodge_bonus": _iget(slot_data, "dodge_bonus"),
        "dodge_reduction": _iget(slot_data, "dodge_reduction"),
        "dodge_ignore": _iget(slot_data, "dodge_ignore"),
        "armor": _iget(slot_data, "armor"),
        "bonus_gains": _iget(slot_data, "bonus_gains"),
        "bonus_moves": _iget(slot_data, "bonus_moves"),
        "bonus_guts": _iget(slot_data, "bonus_guts"),
        "bonus_smarts": _iget(slot_data, "bonus_smarts"),
        "bonus_sense": _iget(slot_data, "bonus_sense"),
        "bonus_rizz": _iget(slot_data, "bonus_rizz"),
        "damage": _iget(slot_data, "damage"),
    }


def aggregate_loadout(hero_slots: dict[str, Any] | None) -> dict[str, Any]:
    """Sum combat-relevant fields across 7 equipment slots (same as production: all slots sum)."""
    t = _empty_combat_bonuses()
    if not hero_slots:
        return t
    for key in SLOT_ORDER:
        raw = hero_slots.get(key)
        if raw is None and key == "main_hand":
            raw = hero_slots.get("mainHand")
        if raw is None and key == "off_hand":
            raw = hero_slots.get("offHand")
        s = _sum_slot_item_dict(raw if isinstance(raw, dict) else None)
        for f in t:
            if f == "crit_damage_bonus":
                t[f] = float(t[f]) + float(s.get(f) or 0)
            else:
                t[f] = int(t[f]) + int(s.get(f) or 0)
    return t


def _hero_merged_stats(hero: dict[str, Any], lo: dict[str, Any]) -> dict[str, int]:
    return {
        "gains": _iget(hero, "base_gains", "gains", default=1) + int(lo["bonus_gains"]),
        "moves": _iget(hero, "base_moves", "moves", default=1) + int(lo["bonus_moves"]),
        "guts": _iget(hero, "base_guts", "guts", default=0) + int(lo["bonus_guts"]),
        "smarts": _iget(hero, "base_smarts", "smarts", default=0) + int(lo["bonus_smarts"]),
        "sense": _iget(hero, "base_sense", "sense", default=0) + int(lo["bonus_sense"]),
        "rizz": _iget(hero, "base_rizz", "rizz", default=0) + int(lo["bonus_rizz"]),
    }


def _main_hand_damage(hero_slots: dict[str, Any] | None) -> tuple[int, bool]:
    """Returns (weapon_damage, is_unarmed)."""
    if not hero_slots:
        return UNARMED_R, True
    mh = hero_slots.get("main_hand") or hero_slots.get("mainHand")
    if not isinstance(mh, dict):
        return UNARMED_R, True
    d = _iget(mh, "damage")
    if d <= 0:
        return UNARMED_R, True
    return d, False


def _sum_armor_from_slots(hero_slots: dict[str, Any] | None) -> int:
    if not hero_slots:
        return 0
    t = 0
    for key in SLOT_ORDER:
        raw = hero_slots.get(key)
        if raw is None and key == "main_hand":
            raw = hero_slots.get("mainHand")
        if raw is None and key == "off_hand":
            raw = hero_slots.get("offHand")
        if isinstance(raw, dict):
            t += _iget(raw, "armor")
    return t


def _crit_chance_stat_cap(level: int) -> float:
    lv = max(1, int(level))
    if lv <= 50:
        return 0.01 + (0.24 / 49.0) * (lv - 1)
    if lv <= 75:
        return 0.25 + 0.01 * (lv - 50)
    return 0.50 + 0.02 * (lv - 75)


def _crit_stat_term(sense: int, level: int, bonus_pct: int) -> float:
    lv = max(1, int(level))
    return (int(sense) / 1200.0) + (lv / 2000.0) + (int(bonus_pct) / 100.0)


def _crit_mult_cap_value(level: int) -> float:
    lv = max(1, int(level))
    if lv <= 50:
        return 1.5 + (0.5 / 49.0) * (lv - 1)
    if lv <= 75:
        return 2.0 + 0.02 * (lv - 50)
    return 2.5 + 0.02 * (lv - 75)


def _crit_mult_stat_term(level: int, item_crit_damage: float) -> float:
    lv = max(1, int(level))
    return 1.5 + 0.0025 * (lv - 1) + float(item_crit_damage)


def build_hero_attacker_dict(
    hero: dict[str, Any],
    hero_slots: dict[str, Any] | None,
    *,
    dark_unlit: bool,
) -> dict[str, Any]:
    lo = aggregate_loadout(hero_slots)
    st = _hero_merged_stats(hero, lo)
    wpn_dmg, is_unarmed = _main_hand_damage(hero_slots)
    return {
        "atk_moves": st["moves"],
        "weapon_accuracy": int(lo["weapon_accuracy"]),
        "weapon": wpn_dmg,
        "gains": st["gains"],
        "level": max(1, _iget(hero, "level", default=1)),
        "is_unarmed": is_unarmed,
        "sense": st["sense"],
        "crit_chance_bonus_pct": int(lo["crit_chance_bonus_pct"]),
        "crit_damage_bonus": float(lo["crit_damage_bonus"]),
        "penetration": int(lo["penetration"]),
        "dodge_reduction_pct": int(lo["dodge_reduction"]),
        "dodge_ignore_active": int(lo["dodge_ignore"] or 0) > 0,
        "hit_chance_base": 50 if dark_unlit else 75,
    }


def build_hero_defender_dict(hero: dict[str, Any], hero_slots: dict[str, Any] | None) -> dict[str, Any]:
    lo = aggregate_loadout(hero_slots)
    st = _hero_merged_stats(hero, lo)
    worn = _sum_armor_from_slots(hero_slots)
    return {
        "def_moves": st["moves"],
        "dodge_bonus": int(lo["dodge_bonus"]),
        "level": max(1, _iget(hero, "level", default=1)),
        "effective_armor": float(worn) / 5.0,
    }


def monster_dict_from_payload(m: dict[str, Any]) -> dict[str, Any]:
    """Fields compatible with combat_math monster attacker/defender."""
    level = max(1, _iget(m, "level", default=1))
    return {
        "level": level,
        "moves": _iget(m, "moves", default=0),
        "armor": _iget(m, "armor", default=0),
        "accuracy": _iget(m, "accuracy", default=0),
        "penetration": _iget(m, "penetration", default=0),
        "crit_chance_bonus_pct": _iget(m, "crit_chance_bonus_pct", default=0),
        "crit_damage_bonus": _fget(m, "crit_damage_bonus", default=0.0),
        "dodge_reduction": _iget(m, "dodge_reduction", default=0),
        "dodge_ignore": _iget(m, "dodge_ignore", default=0),
        "damage_min": max(1, _iget(m, "damage_min", default=1)),
        "damage_max": max(1, _iget(m, "damage_max", default=1)),
    }


def build_monster_attacker_dict(m: dict[str, Any]) -> dict[str, Any]:
    raw = monster_dict_from_payload(m)
    lv = raw["level"]
    return {
        "atk_moves": int(raw["moves"]),
        "weapon_accuracy": int(raw["accuracy"]),
        "weapon": 0,
        "gains": max(1, lv),
        "level": lv,
        "sense": 0,
        "crit_chance_bonus_pct": int(raw["crit_chance_bonus_pct"]),
        "crit_damage_bonus": float(raw["crit_damage_bonus"]),
        "penetration": int(raw["penetration"]),
        "dodge_reduction_pct": int(raw["dodge_reduction"]),
        "dodge_ignore_active": int(raw["dodge_ignore"] or 0) > 0,
    }


def build_monster_defender_dict(m: dict[str, Any]) -> dict[str, Any]:
    raw = monster_dict_from_payload(m)
    return {
        "def_moves": int(raw["moves"]),
        "dodge_bonus": 0,
        "level": int(raw["level"]),
        "effective_armor": float(int(raw["armor"])),
    }


def _hit_breakdown(
    attacker: dict[str, Any], defender: dict[str, Any], *, hit_base: int
) -> dict[str, Any]:
    atk_l = int(attacker["level"])
    def_l = int(defender["level"])
    acc_mod = compute_accuracy_modifier(
        int(attacker["atk_moves"]),
        int(attacker["weapon_accuracy"]),
        atk_l,
    )
    dodge_total = compute_dodge_total(
        int(defender["def_moves"]),
        int(defender["dodge_bonus"]),
        def_l,
    )
    dodge_mod = compute_dodge_modifier(
        dodge_total,
        int(attacker.get("dodge_reduction_pct", 0)),
        bool(attacker.get("dodge_ignore_active", False)),
    )
    raw = float(hit_base) + acc_mod - dodge_mod
    band = min(95.0, max(5.0, float(raw)))
    hit_chance = int(math.floor(band))
    return {
        "moves_scale_attacker": moves_scale(atk_l),
        "moves_scale_defender": moves_scale(def_l),
        "accuracy_budget": accuracy_budget(atk_l),
        "dodge_budget": dodge_budget(def_l),
        "accuracy_modifier": acc_mod,
        "dodge_total": dodge_total,
        "dodge_modifier_effective": dodge_mod,
        "hit_base": hit_base,
        "raw_before_clamp": raw,
        "hit_chance": hit_chance,
    }


def preview_payload(body: dict[str, Any]) -> dict[str, Any]:
    mode = (body.get("mode") or "").strip()
    if mode not in ("hero_attacks", "monster_attacks"):
        raise ValueError("mode must be 'hero_attacks' or 'monster_attacks'")

    hero = body.get("hero") if isinstance(body.get("hero"), dict) else {}
    hero_slots = body.get("hero_slots") or body.get("heroSlots") or {}
    if isinstance(hero_slots, dict):
        hero_slots = {_norm_slot_key(k): v for k, v in hero_slots.items()}
    monster = body.get("monster") if isinstance(body.get("monster"), dict) else {}
    dark_unlit = bool(hero.get("dark_unlit") or hero.get("darkUnlit"))

    mnorm = monster_dict_from_payload(monster)
    out: dict[str, Any] = {
        "mode": mode,
        "monster_paper": {
            "damage_min": mnorm["damage_min"],
            "damage_max": mnorm["damage_max"],
        },
    }

    if mode == "hero_attacks":
        atk = build_hero_attacker_dict(hero, hero_slots, dark_unlit=dark_unlit)
        dfn = build_monster_defender_dict(monster)
        hit_base = int(atk.get("hit_chance_base", 75))
        hb = _hit_breakdown(atk, dfn, hit_base=hit_base)
        out["attacker"] = {**{k: atk[k] for k in atk}, "role": "hero"}
        out["defender"] = {**{k: dfn[k] for k in dfn}, "role": "monster"}
        out["hit"] = hb
        # Damage preview (no RNG): paper only
        lv = int(atk["level"])
        if atk.get("is_unarmed"):
            paper = compute_unarmed_paper_base(lv)
        else:
            paper = compute_base_damage(int(atk["weapon"]), int(atk["gains"]), lv)
        out["damage"] = {
            "kind": "hero_weapon",
            "paper_base": paper,
            "swing_L": max(1, lv),
            "swing_note": f"RolledBase = max(1, paper + U) with U uniform on [-L, L], L = {max(1, lv)}",
            "level_factor": level_factor(lv),
        }
    else:
        atk = build_monster_attacker_dict(monster)
        dfn = build_hero_defender_dict(hero, hero_slots)
        hit_base = 75
        hb = _hit_breakdown(atk, dfn, hit_base=hit_base)
        out["attacker"] = {**{k: atk[k] for k in atk}, "role": "monster"}
        out["defender"] = {**{k: dfn[k] for k in dfn}, "role": "hero"}
        out["hit"] = hb
        dmin, dmax = mnorm["damage_min"], mnorm["damage_max"]
        if dmin > dmax:
            dmin, dmax = dmax, dmin
        paper_mid = (dmin + dmax) // 2
        out["damage"] = {
            "kind": "monster_interval",
            "paper_uniform_min": dmin,
            "paper_uniform_max": dmax,
            "paper_example_mid": paper_mid,
            "swing_L": max(1, int(atk["level"])),
        }

    # Crit + mitigation (shared: attacker crit vs defender armor)
    atk = out["attacker"]
    dfn = out["defender"]
    sense = int(atk.get("sense", 0))
    alv = int(atk["level"])
    bonus_pct = int(atk.get("crit_chance_bonus_pct", 0))
    crit_p = compute_crit_chance(sense, alv, bonus_pct)
    crit_cap = _crit_chance_stat_cap(alv)
    crit_stat = _crit_stat_term(sense, alv, bonus_pct)
    cdb = float(atk.get("crit_damage_bonus", 0.0))
    cmult = compute_crit_multiplier(alv, cdb)
    cmult_cap = _crit_mult_cap_value(alv)
    cmult_stat = _crit_mult_stat_term(alv, cdb)
    pen = int(atk.get("penetration", 0))
    eff_arm = float(dfn.get("effective_armor", 0.0))
    dr = compute_damage_reduction(eff_arm, pen)
    scale = 100 + 2 * pen

    # Example damage through mitigation using paper from hero or mid for monster
    if out["damage"]["kind"] == "hero_weapon":
        paper = int(out["damage"]["paper_base"])
    else:
        paper = int(out["damage"].get("paper_example_mid", 1))
    crit_raw = int(math.floor(paper * cmult)) if paper > 0 else 0
    out["crit"] = {
        "crit_chance": crit_p,
        "crit_chance_cap": crit_cap,
        "crit_stat_term": crit_stat,
        "crit_multiplier": cmult,
        "crit_multiplier_cap": cmult_cap,
        "crit_multiplier_stat_term": cmult_stat,
    }
    out["mitigation"] = {
        "effective_armor": eff_arm,
        "mitigation_scale": scale,
        "penetration": pen,
        "damage_reduction": dr,
    }
    out["example_final_damage"] = {
        "using_paper": paper,
        "non_crit": compute_final_damage(paper, dr),
        "crit": compute_final_damage(crit_raw, dr) if crit_raw > 0 else 1,
    }

    return out
