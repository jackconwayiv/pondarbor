from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase, TestCase

from closet.slack_ask_parse import (
    item_query_from_message_matches,
    looks_like_chatter,
    parse_closet_ask,
    parse_request_command_text,
    score_closet_items_for_message,
    score_closet_items_for_query,
    score_item_for_query,
)
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

    def test_anyone_got_informal(self):
        parsed = parse_closet_ask("anyone got a multimeter")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.item_query.casefold(), "multimeter")

    def test_anybody_got(self):
        parsed = parse_closet_ask("anybody got jumper cables?")
        self.assertEqual(parsed.item_query.casefold(), "jumper cables")

    def test_has_anyone_got(self):
        parsed = parse_closet_ask("has anyone got a multimeter")
        self.assertEqual(parsed.item_query.casefold(), "multimeter")

    def test_six_ask_phrasings(self):
        phrases = (
            "Does anyone have an extension cord?",
            "I need an extension cord",
            "Can I borrow an extension cord from somebody",
            "Anyone got an extension cord",
            "Borrow request for an extension cord",
            "Borrow: extension cord",
        )
        for text in phrases:
            parsed = parse_closet_ask(text)
            self.assertIsNotNone(parsed, msg=text)
            self.assertEqual(parsed.item_query.casefold(), "extension cord", msg=text)

    def test_love_to_borrow_ignores_trailing_anyone_has_one(self):
        parsed = parse_closet_ask(
            "for real tho i would love to borrow a weedwhacker if anyone has one"
        )
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.item_query.casefold(), "weedwhacker")

    def test_borrow_a_an_some_takes_the_following_object(self):
        cases = (
            ("borrow a weedwhacker", "weedwhacker"),
            ("borrow an extension cord", "extension cord"),
            ("borrow some placemats", "placemats"),
            ("could I maybe borrow a ladder", "ladder"),
        )
        for text, expected in cases:
            parsed = parse_closet_ask(text)
            self.assertIsNotNone(parsed, msg=text)
            self.assertEqual(parsed.item_query.casefold(), expected, msg=text)

    def test_request_command_text(self):
        self.assertEqual(parse_request_command_text("a weedwhacker")[0].casefold(), "weedwhacker")
        query, qty = parse_request_command_text("4 placemats")
        self.assertEqual(query.casefold(), "placemats")
        self.assertEqual(qty, 4)
        self.assertEqual(parse_request_command_text(""), ("", None))
        self.assertEqual(parse_request_command_text("it"), ("", None))


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


class ClosetMessageScanTests(SimpleTestCase):
    def test_scans_each_word_against_item_names(self):
        items = [
            SimpleNamespace(name="Fluke Multimeter", description="", tags=[]),
            SimpleNamespace(name="Cocktail dress", description="", tags=[]),
        ]
        ranked = score_closet_items_for_message("anyone got a multimeter", items)
        self.assertEqual([i.name for i in ranked], ["Fluke Multimeter"])

    def test_bigram_hits_multi_word_name(self):
        items = [
            SimpleNamespace(name="Table saw", description="", tags=[]),
            SimpleNamespace(name="Cocktail dress", description="", tags=[]),
        ]
        ranked = score_closet_items_for_message("anyone got a table saw", items)
        self.assertEqual([i.name for i in ranked], ["Table saw"])

    def test_short_unigram_does_not_hit_multi_word_name(self):
        items = [SimpleNamespace(name="Table saw", description="", tags=[])]
        ranked = score_closet_items_for_message("set the table for dinner", items)
        self.assertEqual(ranked, [])

    def test_chatter_helpers(self):
        self.assertTrue(looks_like_chatter("Thanks everyone"))
        self.assertTrue(looks_like_chatter("I returned the table saw"))
        self.assertTrue(looks_like_chatter("Love this integration tho!"))
        self.assertFalse(looks_like_chatter("anyone got a multimeter"))

    def test_compliment_does_not_scan_as_love(self):
        items = [
            SimpleNamespace(name="Glove", description="", tags=[]),
            SimpleNamespace(name="Gloves", description="", tags=[]),
        ]
        ranked = score_closet_items_for_message("Love this integration tho!", items)
        self.assertEqual(ranked, [])

    def test_unigram_prefix_still_matches_plural(self):
        items = [SimpleNamespace(name="Gloves", description="", tags=[])]
        ranked = score_closet_items_for_message("glove?", items)
        self.assertEqual([i.name for i in ranked], ["Gloves"])

    def test_item_query_from_scan(self):
        items = [SimpleNamespace(name="Fluke Multimeter", description="", tags=[])]
        self.assertEqual(
            item_query_from_message_matches("anyone got a multimeter", items),
            "multimeter",
        )


class ClosetMessageScanDbTests(ClosetTestMixin, TestCase):
    def test_scans_owned_items_from_db(self):
        self.create_users()
        meter = self.make_item(owner=self.owner, name="Fluke Multimeter")
        dress = self.make_item(owner=self.owner, name="Cocktail dress")
        ranked = score_closet_items_for_message("need a multimeter", [meter, dress])
        self.assertEqual([row.id for row in ranked], [meter.id])
