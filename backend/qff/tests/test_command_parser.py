from django.test import SimpleTestCase

from qff.command_parser import (
    ParsedConsumeItem,
    ParsedGet,
    ParsedMove,
    ParsedSearch,
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
