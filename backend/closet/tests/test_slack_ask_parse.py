from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase, TestCase

from closet.slack_ask_parse import parse_closet_ask, score_closet_items_for_query, score_item_for_query
from closet.tests.helpers import ClosetTestMixin


class ClosetAskParseTests(SimpleTestCase):
    def test_example_table_saw(self):
        parsed = parse_closet_ask("Does anyone have a table saw?")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.item_query.casefold(), "table saw")
        self.assertIsNone(parsed.quantity)

    def test_example_weedwhacker(self):
        parsed = parse_closet_ask("Does anyone have a weedwhacker?")
        self.assertEqual(parsed.item_query.casefold(), "weedwhacker")

    def test_example_placemats_qty(self):
        parsed = parse_closet_ask("Does anyone have placemats? I need 4.")
        self.assertEqual(parsed.item_query.casefold(), "placemats")
        self.assertEqual(parsed.quantity, 4)

    def test_example_ten_plates(self):
        parsed = parse_closet_ask("Can I borrow ten plates?")
        self.assertEqual(parsed.item_query.casefold(), "plates")
        self.assertEqual(parsed.quantity, 10)

    def test_example_camping_chairs(self):
        parsed = parse_closet_ask("I need to borrow 3 camping chairs.")
        self.assertEqual(parsed.item_query.casefold(), "camping chairs")
        self.assertEqual(parsed.quantity, 3)

    def test_example_clothes_rack(self):
        parsed = parse_closet_ask("Who has a clothes rack?")
        self.assertEqual(parsed.item_query.casefold(), "clothes rack")

    def test_example_cocktail_dress(self):
        parsed = parse_closet_ask("Could I borrow a cocktail dress?")
        self.assertEqual(parsed.item_query.casefold(), "cocktail dress")

    def test_need_by_tomorrow(self):
        today = date(2026, 8, 30)
        parsed = parse_closet_ask("Can I borrow a ladder by tomorrow?", today=today)
        self.assertEqual(parsed.item_query.casefold(), "ladder")
        self.assertEqual(parsed.date_needed_by, date(2026, 8, 31))

    def test_need_by_weekday(self):
        today = date(2026, 8, 30)  # Sunday
        parsed = parse_closet_ask("Does anyone have a tent by Friday?", today=today)
        self.assertEqual(parsed.item_query.casefold(), "tent")
        self.assertEqual(parsed.date_needed_by, date(2026, 9, 4))

    def test_need_by_mdy(self):
        today = date(2026, 8, 30)
        parsed = parse_closet_ask("Can I borrow plates by 9/15?", today=today)
        self.assertEqual(parsed.date_needed_by, date(2026, 9, 15))

    def test_past_date_clamps_to_today(self):
        today = date(2026, 8, 30)
        parsed = parse_closet_ask("Can I borrow a hammer by 2020-01-01?", today=today)
        self.assertEqual(parsed.date_needed_by, today)

    def test_ignores_chatter(self):
        self.assertIsNone(parse_closet_ask("Thanks!"))
        self.assertIsNone(parse_closet_ask("I returned the saw"))
        self.assertIsNone(parse_closet_ask("good morning"))
        self.assertIsNone(parse_closet_ask("lol"))

    def test_i_need_qty_item(self):
        parsed = parse_closet_ask("I need 4 placemats")
        self.assertEqual(parsed.item_query.casefold(), "placemats")
        self.assertEqual(parsed.quantity, 4)


class ClosetAskMatchScoreTests(SimpleTestCase):
    def test_exact_name(self):
        self.assertEqual(score_item_for_query("table saw", name="Table Saw"), 1.0)

    def test_tokens_in_name(self):
        score = score_item_for_query("table saw", name="Dewalt table saw")
        self.assertGreaterEqual(score, 0.85)

    def test_collapsed_weedwhacker(self):
        score = score_item_for_query("weedwhacker", name="weed whacker")
        self.assertGreaterEqual(score, 0.9)

    def test_unrelated_below_threshold(self):
        score = score_item_for_query("table saw", name="cocktail dress")
        self.assertLess(score, 0.42)

    def test_ranks_close_items(self):
        items = [
            SimpleNamespace(name="Cocktail dress", description="", tags=[]),
            SimpleNamespace(name="Table saw", description="", tags=[]),
            SimpleNamespace(name="Saw horses", description="", tags=[]),
        ]
        ranked = score_closet_items_for_query("table saw", items)
        self.assertEqual(ranked[0].name, "Table saw")
        self.assertNotIn("Cocktail dress", [i.name for i in ranked])


class ClosetAskMatchDbTests(ClosetTestMixin, TestCase):
    def test_scores_owned_items_from_db(self):
        self.create_users()
        saw = self.make_item(owner=self.owner, name="Table saw")
        dress = self.make_item(owner=self.owner, name="Cocktail dress")
        ranked = score_closet_items_for_query("table saw", [saw, dress])
        self.assertEqual([row.id for row in ranked], [saw.id])
