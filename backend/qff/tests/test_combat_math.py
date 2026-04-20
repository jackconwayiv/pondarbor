"""Unit tests for physical combat formulas (no DB)."""

from unittest import TestCase
from unittest.mock import patch

from qff.combat_math import (
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
    level_factor,
    resolve_physical_strike,
)


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

    def test_dodge_on_second_roll(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 1]):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "dodge")
        self.assertEqual(r.damage, 0)

    def test_hit_not_crit(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "hit")
        self.assertFalse(r.was_crit)
        self.assertGreater(r.damage, 0)

    def test_crit_branch(self):
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.0
        ):
            r = resolve_physical_strike(self._sample_attacker(), self._sample_defender())
        self.assertEqual(r.outcome, "crit")
        self.assertTrue(r.was_crit)
        self.assertGreaterEqual(r.damage, r.base_damage)

    def test_mitigation_reduces_damage(self):
        atk = self._sample_attacker()
        soft = self._sample_defender()
        hard = {**soft, "armor": 200}
        with patch("qff.combat_math.roll_d100", side_effect=[50, 99, 50, 99]), patch(
            "qff.combat_math.random.random", return_value=0.99
        ):
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
        ):
            r = resolve_physical_strike(atk, dfn, flat_base_damage=3)
        self.assertEqual(r.outcome, "hit")
        self.assertEqual(r.base_damage, 3)
