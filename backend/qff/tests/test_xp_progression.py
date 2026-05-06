from django.test import SimpleTestCase

from qff.xp_progression import actual_xp, base_xp, kills_to_level, xp_modifier, xp_to_next


class XpProgressionTests(SimpleTestCase):
    def test_level_thresholds_every_four_levels(self):
        self.assertEqual(base_xp(1), 10)
        self.assertEqual(kills_to_level(1), 7)
        self.assertEqual(kills_to_level(4), 7)
        self.assertEqual(kills_to_level(5), 8)
        self.assertEqual(kills_to_level(9), 9)
        self.assertEqual(xp_to_next(1), 70)
        self.assertEqual(xp_to_next(5), 464)

    def test_xp_modifier_floors(self):
        self.assertEqual(xp_modifier(20, 19), 0.80)
        self.assertEqual(xp_modifier(20, 18), 0.60)
        self.assertEqual(xp_modifier(20, 17), 0.40)
        self.assertEqual(xp_modifier(20, 16), 0.20)
        self.assertEqual(xp_modifier(20, 15), 0.00)

    def test_xp_modifier_start_values(self):
        self.assertEqual(xp_modifier(3, 1), 0.80)  # L-2 starts at 80% at level 3
        self.assertEqual(xp_modifier(4, 1), 0.60)  # L-3 starts at 60% at level 4
        self.assertEqual(xp_modifier(5, 1), 0.40)  # L-4 starts at 40% at level 5
        self.assertEqual(xp_modifier(6, 1), 0.20)  # L-5 starts at 20% at level 6

    def test_actual_xp_uses_template_value(self):
        # 100 template XP at L10 vs L6 (gap 4 => 20%)
        self.assertEqual(actual_xp(10, 6, 100), 20)
