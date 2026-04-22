"""Unit tests for physical combat formulas (no DB)."""

from unittest import TestCase
from unittest.mock import patch

from qff.combat_math import (
    apply_damage_swing,
    clamp_hit_chance,
    compute_base_damage,
    compute_crit_chance,
    compute_crit_damage,
    compute_crit_multiplier,
    compute_damage_reduction,
    compute_dodge_chance,
    compute_effective_dodge_chance,
    compute_final_damage,
    compute_hit_chance,
    compute_unarmed_paper_base,
    level_factor,
    resolve_physical_strike,
)
from qff.constants import UNARMED_WEAPON_RATING


class CombatMathFormulaTests(TestCase):
    def test_clamp_hit_chance(self):
        self.assertEqual(clamp_hit_chance(4), 5)
        self.assertEqual(clamp_hit_chance(5), 5)
        self.assertEqual(clamp_hit_chance(50), 50)
        self.assertEqual(clamp_hit_chance(95), 95)
        self.assertEqual(clamp_hit_chance(96), 95)

    def test_compute_hit_chance(self):
        self.assertEqual(compute_hit_chance(0, 0, 0), 75)
        self.assertEqual(compute_hit_chance(10, 0, 0), 80)
        self.assertEqual(compute_hit_chance(0, 0, 10), 70)
        self.assertEqual(compute_hit_chance(-100, 0, 200), 5)
        self.assertEqual(compute_hit_chance(200, 0, -200), 95)

    def test_compute_hit_chance_custom_base(self):
        self.assertEqual(compute_hit_chance(0, 0, 0, base=50), 50)
        self.assertEqual(compute_hit_chance(10, 0, 0, base=50), 55)

    def test_dodge_and_effective(self):
        self.assertEqual(compute_dodge_chance(0, 0), 1)
        self.assertEqual(compute_dodge_chance(19, 0), 1)
        self.assertEqual(compute_dodge_chance(20, 0), 1)
        self.assertEqual(compute_dodge_chance(40, 3), 5)
        self.assertEqual(compute_effective_dodge_chance(10, 2, 3), 5)
        self.assertEqual(compute_effective_dodge_chance(1, 0, 0), 1)

    def test_crit_chance(self):
        self.assertAlmostEqual(compute_crit_chance(0, 0, 0), 0.0)
        self.assertAlmostEqual(compute_crit_chance(100, 0, 0), 0.1)
        self.assertAlmostEqual(compute_crit_chance(0, 100, 0), 0.1)
        self.assertAlmostEqual(compute_crit_chance(0, 0, 50), 0.5)

    def test_level_factor(self):
        self.assertAlmostEqual(level_factor(1), 1.0)
        self.assertAlmostEqual(level_factor(99), 3.0)
        self.assertAlmostEqual(level_factor(50), 1.0 + 2.0 * 49 / 98)

    def test_base_damage(self):
        self.assertEqual(compute_base_damage(0, 1, 1), 2)
        # (3 * weapon + 2 * gains) * level_factor
        self.assertEqual(compute_base_damage(10, 5, 1), 40)
        lv99 = compute_base_damage(1, 1, 99)
        self.assertGreater(lv99, compute_base_damage(1, 1, 1))

    def test_crit_multiplier_and_damage(self):
        self.assertAlmostEqual(compute_crit_multiplier(1, 0.0), 1.5)
        self.assertEqual(compute_crit_damage(10, 1.5), 15)
        self.assertEqual(compute_crit_damage(10, 1.25), 12)

    def test_damage_reduction_and_final(self):
        self.assertEqual(compute_damage_reduction(0, 0), 0.0)
        self.assertAlmostEqual(compute_damage_reduction(100, 0), 0.5)
        # MitigationScale = 100 + 2 * penetration
        self.assertAlmostEqual(compute_damage_reduction(100, 50), 100 / (100 + 200))
        self.assertEqual(compute_final_damage(100, 0.5), 50)
        self.assertEqual(compute_final_damage(1, 0.99), 1)


class ResolvePhysicalStrikeTests(TestCase):
    def _sample_attacker(self):
        return {
            "atk_moves": 0,
            "weapon_accuracy": 0,
            "weapon": 10,
            "gains": 5,
            "level": 1,
            "sense": 0,
            "crit_chance_bonus_pct": 0,
            "crit_damage_bonus": 0.0,
            "penetration": 0,
            "dodge_reduction": 0,
            "dodge_ignore": 0,
        }

    def _sample_defender(self):
        return {"def_moves": 0, "dodge_bonus": 0, "armor": 0}

    def test_miss_stops_before_second_roll(self):
        with patch("qff.combat_math.roll_d100", return_value=76) as m_roll:
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "miss")
        self.assertEqual(r.damage, 0)
        self.assertEqual(m_roll.call_count, 1)

    def test_miss_with_lower_hit_chance_base(self):
        atk = {**self._sample_attacker(), "hit_chance_base": 50}
        with patch("qff.combat_math.roll_d100", return_value=60) as m_roll:
            r = resolve_physical_strike(atk, self._sample_defender())
        self.assertEqual(r.outcome, "miss")
        self.assertEqual(r.hit_chance, 50)
        self.assertEqual(m_roll.call_count, 1)

    def test_dodge_on_second_roll(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 1]):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "dodge")
        self.assertEqual(r.damage, 0)

    def test_hit_not_crit(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ), patch("qff.combat_math.random.randint", return_value=0):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "hit")
        self.assertFalse(r.was_crit)
        self.assertGreater(r.damage, 0)
        self.assertEqual(r.rolled_base, r.base_damage)

    def test_crit_branch(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.0
        ), patch("qff.combat_math.random.randint", return_value=0):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "crit")
        self.assertTrue(r.was_crit)
        self.assertGreaterEqual(r.damage, r.rolled_base)

    def test_mitigation_reduces_damage(self):
        atk = self._sample_attacker()
        soft = self._sample_defender()
        hard = {**soft, "armor": 200}
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99, 50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ), patch("qff.combat_math.random.randint", return_value=0):
            r_soft = resolve_physical_strike(atk, soft)
            r_hard = resolve_physical_strike(atk, hard)
        self.assertEqual(r_soft.outcome, "hit")
        self.assertEqual(r_hard.outcome, "hit")
        self.assertGreater(r_soft.damage, r_hard.damage)

    def test_flat_base_damage_skips_weapon_formula(self):
        atk = {**self._sample_attacker(), "weapon": 0}
        dfn = self._sample_defender()
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ), patch("qff.combat_math.random.randint", return_value=0):
            r = resolve_physical_strike(atk, dfn, flat_base_damage=3)
        self.assertEqual(r.outcome, "hit")
        self.assertEqual(r.base_damage, 3)
        self.assertEqual(r.rolled_base, 3)

    def test_unarmed_paper_base_is_one_plus_level(self):
        """Unarmed uses 1+level, not the weapon×gains formula."""
        self.assertEqual(compute_unarmed_paper_base(1), 2)
        self.assertEqual(compute_unarmed_paper_base(10), 11)
        self.assertEqual(compute_base_damage(UNARMED_WEAPON_RATING, 1, 1), 5)

    def test_monster_paper_in_range_then_positive_swing_can_exceed_template_max(self):
        """Paper is the template-interval roll (here fixed 3); +L can push above damage_max."""
        atk = {**self._sample_attacker(), "level": 1}
        dfn = self._sample_defender()
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ), patch("qff.combat_math.random.randint", return_value=1):
            r = resolve_physical_strike(atk, dfn, flat_base_damage=3)
        self.assertEqual(r.outcome, "hit")
        self.assertEqual(r.base_damage, 3)
        self.assertEqual(r.rolled_base, 4)
        self.assertEqual(r.damage, 4)

    def test_monster_flat_base_damage_mitigation_matches_formula(self):
        """``flat_base_damage`` is monster paper (uniform [min,max] in sim); mitigation matches Armor/(Armor+Scale)."""
        atk = {
            "atk_moves": 0,
            "weapon_accuracy": 0,
            "weapon": 0,
            "gains": 1,
            "level": 1,
            "sense": 0,
            "crit_chance_bonus_pct": 0,
            "crit_damage_bonus": 0.0,
            "penetration": 0,
            "dodge_reduction": 0,
            "dodge_ignore": 0,
        }
        dfn = {"def_moves": 0, "dodge_bonus": 0, "armor": 100}
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ), patch("qff.combat_math.random.randint", return_value=0):
            r = resolve_physical_strike(atk, dfn, flat_base_damage=10)
        self.assertEqual(r.outcome, "hit")
        self.assertEqual(r.base_damage, 10)
        self.assertEqual(r.rolled_base, 10)
        dr = compute_damage_reduction(100, 0)
        self.assertAlmostEqual(dr, 0.5)
        self.assertEqual(r.damage, compute_final_damage(10, dr))

    def test_crit_damage_branch_uses_floor_base_times_multiplier(self):
        atk = self._sample_attacker()
        dfn = self._sample_defender()
        base = compute_base_damage(atk["weapon"], atk["gains"], atk["level"])
        mult = compute_crit_multiplier(atk["level"], atk["crit_damage_bonus"])
        crit_raw = compute_crit_damage(base, mult)
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.0
        ), patch("qff.combat_math.random.randint", return_value=0):
            r = resolve_physical_strike(atk, dfn)
        self.assertEqual(r.outcome, "crit")
        self.assertEqual(r.base_damage, base)
        self.assertEqual(r.rolled_base, base)
        self.assertEqual(r.damage, compute_final_damage(crit_raw, 0.0))

    def test_apply_damage_swing(self):
        with patch("qff.combat_math.random.randint", return_value=-2):
            self.assertEqual(apply_damage_swing(5, 2), 3)
        with patch("qff.combat_math.random.randint", return_value=2):
            self.assertEqual(apply_damage_swing(5, 2), 7)
        with patch("qff.combat_math.random.randint", return_value=-10):
            self.assertEqual(apply_damage_swing(5, 10), 1)

    def test_damage_swing_level_one_band_unarmed(self):
        """Unarmed paper = 1+level; at level 1, base 2, L=1 → rolled in {1,2,3} before armor."""
        atk = {
            **self._sample_attacker(),
            "weapon": UNARMED_WEAPON_RATING,
            "gains": 99,
            "level": 1,
            "is_unarmed": True,
        }
        dfn = self._sample_defender()
        self.assertEqual(compute_unarmed_paper_base(1), 2)
        for u in (-1, 0, 1):
            with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
                "qff.combat_math.random.random", return_value=0.99
            ), patch("qff.combat_math.random.randint", return_value=u):
                r = resolve_physical_strike(atk, dfn)
            self.assertEqual(r.outcome, "hit")
            self.assertEqual(r.base_damage, 2)
            self.assertEqual(r.rolled_base, 2 + u)
            self.assertEqual(r.damage, 2 + u)
