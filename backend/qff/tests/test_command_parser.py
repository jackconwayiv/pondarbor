from django.test import SimpleTestCase

from qff.command_parser import (
    ParsedConsumeItem,
    ParsedGet,
    ParsedMove,
    ParsedRead,
    ParsedSearch,
    ParsedSell,
    ParsedShopBrowse,
    ParsedShopBuy,
    ParsedUnknown,
    parse_command,
)
from qff.models import RoomExit


class CommandParserTests(SimpleTestCase):
    def test_cardinals(self):
        for cmd in ("n", "north", "/north", "go north", "N", "GO NORTH"):
            p = parse_command(cmd)
            self.assertIsInstance(p, ParsedMove)
            assert isinstance(p, ParsedMove)
            self.assertEqual(p.direction, RoomExit.Direction.N)

    def test_intercardinals(self):
        p = parse_command("nw")
        self.assertIsInstance(p, ParsedMove)
        assert isinstance(p, ParsedMove)
        self.assertEqual(p.direction, RoomExit.Direction.NW)

    def test_up_down_in_out(self):
        self.assertEqual(
            parse_command("u").direction,  # type: ignore
            RoomExit.Direction.UP,
        )
        self.assertEqual(
            parse_command("d").direction,  # type: ignore
            RoomExit.Direction.DOWN,
        )
        p = parse_command("enter")
        self.assertIsInstance(p, ParsedMove)
        assert isinstance(p, ParsedMove)
        self.assertEqual(p.direction, RoomExit.Direction.IN)
        p = parse_command("leave")
        self.assertIsInstance(p, ParsedMove)
        assert isinstance(p, ParsedMove)
        self.assertEqual(p.direction, RoomExit.Direction.OUT)

    def test_search(self):
        self.assertIsInstance(parse_command("search"), ParsedSearch)
        self.assertIsInstance(parse_command("/search"), ParsedSearch)

    def test_unknown(self):
        self.assertIsInstance(parse_command("xyzzy"), ParsedUnknown)

    def test_take_alias(self):
        p = parse_command("take red potion")
        self.assertIsInstance(p, ParsedGet)
        assert isinstance(p, ParsedGet)
        self.assertEqual(p.target, "red potion")

    def test_eat_drink(self):
        e = parse_command("eat bread")
        self.assertIsInstance(e, ParsedConsumeItem)
        assert isinstance(e, ParsedConsumeItem)
        self.assertEqual(e.verb, "eat")
        self.assertEqual(e.target, "bread")
        d = parse_command("drink water")
        self.assertIsInstance(d, ParsedConsumeItem)
        assert isinstance(d, ParsedConsumeItem)
        self.assertEqual(d.verb, "drink")
        self.assertEqual(d.target, "water")

    def test_read(self):
        p = parse_command("read sign")
        self.assertIsInstance(p, ParsedRead)
        assert isinstance(p, ParsedRead)
        self.assertEqual(p.target, "sign")
        p2 = parse_command("/read tome")
        self.assertIsInstance(p2, ParsedRead)
        assert isinstance(p2, ParsedRead)
        self.assertEqual(p2.target, "tome")
        p3 = parse_command("read")
        self.assertIsInstance(p3, ParsedRead)
        assert isinstance(p3, ParsedRead)
        self.assertEqual(p3.target, "")

    def test_shop_commands(self):
        self.assertIsInstance(parse_command("shop"), ParsedShopBrowse)
        self.assertIsInstance(parse_command("/list"), ParsedShopBrowse)
        p = parse_command("shop alice")
        self.assertIsInstance(p, ParsedShopBrowse)
        assert isinstance(p, ParsedShopBrowse)
        self.assertEqual(p.npc_query, "alice")
        self.assertIsInstance(parse_command("buy"), ParsedShopBrowse)
        self.assertIsInstance(parse_command("purchase"), ParsedShopBrowse)
        b = parse_command("buy rusty sword")
        self.assertIsInstance(b, ParsedShopBuy)
        assert isinstance(b, ParsedShopBuy)
        self.assertEqual(b.item_query, "rusty sword")
        b2 = parse_command("buy apple from bob")
        self.assertIsInstance(b2, ParsedShopBuy)
        assert isinstance(b2, ParsedShopBuy)
        self.assertEqual(b2.item_query, "apple")
        self.assertEqual(b2.npc_query, "bob")
        s = parse_command("sell gem")
        self.assertIsInstance(s, ParsedSell)
        assert isinstance(s, ParsedSell)
        self.assertEqual(s.item_query, "gem")
        s2 = parse_command("sell gem to alice")
        self.assertIsInstance(s2, ParsedSell)
        assert isinstance(s2, ParsedSell)
        self.assertEqual(s2.item_query, "gem")
        self.assertEqual(s2.npc_query, "alice")
