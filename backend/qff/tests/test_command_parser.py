from django.test import SimpleTestCase

from qff.command_parser import (
    ParsedAttack,
    ParsedBuyAbilities,
    ParsedConsumeItem,
    ParsedEquip,
    ParsedGet,
    ParsedLookDirection,
    ParsedLookInspect,
    ParsedMove,
    ParsedOpenContainer,
    ParsedPut,
    ParsedRead,
    ParsedSearch,
    ParsedSell,
    ParsedShopBrowse,
    ParsedShopBuy,
    ParsedUnequip,
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
        p = parse_command("out")
        self.assertIsInstance(p, ParsedMove)
        assert isinstance(p, ParsedMove)
        self.assertEqual(p.direction, RoomExit.Direction.OUT)

    def test_mud_prompt_prefix_stripped(self):
        p = parse_command("> attack sewer rat")
        self.assertIsInstance(p, ParsedAttack)
        assert isinstance(p, ParsedAttack)
        self.assertEqual(p.target, "sewer rat")

    def test_search(self):
        self.assertIsInstance(parse_command("search"), ParsedSearch)
        self.assertIsInstance(parse_command("/search"), ParsedSearch)

    def test_unknown(self):
        self.assertIsInstance(parse_command("xyzzy"), ParsedUnknown)

    def test_buy_abilities_placeholder(self):
        self.assertIsInstance(parse_command("buy abilities"), ParsedBuyAbilities)
        self.assertIsInstance(parse_command("/purchase abilities"), ParsedBuyAbilities)

    def test_take_alias(self):
        p = parse_command("take red potion")
        self.assertIsInstance(p, ParsedGet)
        assert isinstance(p, ParsedGet)
        self.assertEqual(p.target, "red potion")
        self.assertIsNone(p.quantity)

    def test_take_quantity_gold(self):
        p = parse_command("take 3 gold")
        self.assertIsInstance(p, ParsedGet)
        assert isinstance(p, ParsedGet)
        self.assertEqual(p.target, "gold")
        self.assertEqual(p.quantity, 3)

    def test_pick_up(self):
        p = parse_command("pick up gold")
        self.assertIsInstance(p, ParsedGet)
        assert isinstance(p, ParsedGet)
        self.assertEqual(p.target, "gold")

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

    def test_equip_synonyms(self):
        w = parse_command("wear hat")
        self.assertIsInstance(w, ParsedEquip)
        assert isinstance(w, ParsedEquip)
        self.assertEqual(w.target, "hat")
        p = parse_command("put on boots")
        self.assertIsInstance(p, ParsedEquip)
        assert isinstance(p, ParsedEquip)
        self.assertEqual(p.target, "boots")

    def test_unequip_synonyms(self):
        r = parse_command("remove ring")
        self.assertIsInstance(r, ParsedUnequip)
        assert isinstance(r, ParsedUnequip)
        self.assertEqual(r.target, "ring")
        t = parse_command("take off cloak")
        self.assertIsInstance(t, ParsedUnequip)
        assert isinstance(t, ParsedUnequip)
        self.assertEqual(t.target, "cloak")

    def test_take_off_not_parsed_as_get(self):
        p = parse_command("take off ring")
        self.assertIsInstance(p, ParsedUnequip)
        assert isinstance(p, ParsedUnequip)
        self.assertEqual(p.target, "ring")

    def test_grab_alias(self):
        g = parse_command("grab coin")
        self.assertIsInstance(g, ParsedGet)
        assert isinstance(g, ParsedGet)
        self.assertEqual(g.target, "coin")

    def test_put_place(self):
        p = parse_command("put scroll")
        self.assertIsInstance(p, ParsedPut)
        assert isinstance(p, ParsedPut)
        self.assertEqual(p.target, "scroll")
        p2 = parse_command("place torch")
        self.assertIsInstance(p2, ParsedPut)
        assert isinstance(p2, ParsedPut)
        self.assertEqual(p2.target, "torch")

    def test_open_container_parse_type(self):
        p = parse_command("open chest")
        self.assertIsInstance(p, ParsedOpenContainer)
        assert isinstance(p, ParsedOpenContainer)
        self.assertEqual(p.target, "chest")
        bare = parse_command("open")
        self.assertIsInstance(bare, ParsedOpenContainer)
        assert isinstance(bare, ParsedOpenContainer)
        self.assertEqual(bare.target, "")

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
        s3 = parse_command("sell all gem")
        self.assertIsInstance(s3, ParsedSell)
        assert isinstance(s3, ParsedSell)
        self.assertEqual(s3.item_query, "gem")
        self.assertEqual(s3.npc_query, "")
        self.assertEqual(s3.sell_all, True)
        s4 = parse_command("sell all gem to alice")
        self.assertIsInstance(s4, ParsedSell)
        assert isinstance(s4, ParsedSell)
        self.assertEqual(s4.item_query, "gem")
        self.assertEqual(s4.npc_query, "alice")
        self.assertEqual(s4.sell_all, True)

    def test_look_direction_tokens(self):
        p = parse_command("look e")
        self.assertIsInstance(p, ParsedLookDirection)
        assert isinstance(p, ParsedLookDirection)
        self.assertEqual(p.direction, RoomExit.Direction.E)
        self.assertEqual(p.original_token, "e")
        p2 = parse_command("look north")
        self.assertIsInstance(p2, ParsedLookDirection)
        assert isinstance(p2, ParsedLookDirection)
        self.assertEqual(p2.direction, RoomExit.Direction.N)
        p3 = parse_command("look at e")
        self.assertIsInstance(p3, ParsedLookInspect)
        assert isinstance(p3, ParsedLookInspect)
        self.assertEqual(p3.target, "e")
