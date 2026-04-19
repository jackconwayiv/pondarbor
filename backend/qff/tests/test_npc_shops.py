"""NPC shop buy/sell/list, consignment decay, crafted exemption."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import (
    Area,
    Character,
    CharacterClass,
    Item,
    ItemInstance,
    Npc,
    NpcShop,
    NpcShopStockLine,
    Room,
)
from qff.shop_engine import SHOP_DECAY_THRESHOLD, browse_shop

User = get_user_model()


def _room(slug: str) -> Room:
    area = Area.objects.create(
        name=f"A-{slug}",
        slug=f"area-{slug}",
        grid_width=1,
        grid_height=1,
    )
    return Room.objects.create(area=area, name="Room", slug=slug)


class NpcShopTests(TestCase):
    def setUp(self):
        self.room = _room("npc-shop-t")
        self.cc = CharacterClass.objects.create(slug="war-nps", name="Warrior", sort_order=0)

    def _char(self, name: str, *, gold: int = 0) -> Character:
        u = User.objects.create_user(email=f"{name.lower()}@example.com", password="secret12345")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        return Character.objects.create(
            user=u,
            name=name,
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            gold=gold,
            cur_health=10,
            max_health=20,
            cur_mana=0,
            max_mana=10,
        )

    def test_buy_static_and_stock_decrements(self):
        npc = Npc.objects.create(
            room=self.room,
            slug="keeper",
            name="Keeper",
            description="",
        )
        shop = NpcShop.objects.create(
            npc=npc,
            welcome_text="Welcome.",
            enabled=True,
            sell_price_percent=50,
        )
        sword = Item.objects.create(
            slug="sw-nps",
            name="Rusty Blade",
            cost=100,
        )
        NpcShopStockLine.objects.create(
            shop=shop,
            item=sword,
            price=40,
            quantity=1,
            sort_order=0,
            kind=NpcShopStockLine.Kind.STATIC,
        )
        c = self._char("Hero", gold=100)
        out = execute_command(c, parse_command("shop"))
        self.assertTrue(any("Welcome." in line for line in out))
        out2 = execute_command(c, parse_command("buy rusty blade"))
        self.assertTrue(any("buy" in line.lower() for line in out2))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.gold, 60)
        self.assertEqual(len(c.inventory), 1)
        line = NpcShopStockLine.objects.get(shop=shop, item=sword)
        self.assertEqual(line.quantity, 0)
        out3 = execute_command(c, parse_command("buy rusty blade"))
        self.assertTrue(any("sold out" in m.lower() for m in out3))

    def test_sell_creates_consignment(self):
        npc = Npc.objects.create(
            room=self.room,
            slug="buyer",
            name="Buyer",
            description="",
        )
        NpcShop.objects.create(npc=npc, welcome_text="", enabled=True, sell_price_percent=50)
        gem = Item.objects.create(slug="gem-nps", name="Gem", cost=20)
        c = self._char("Seller", gold=0)
        inst = ItemInstance.objects.create(item=gem, owner_character=c, quantity=1)
        c.inventory = [inst.pk]
        c.save(update_fields=["inventory"])
        out = execute_command(c, parse_command("sell gem"))
        self.assertTrue(any("10 gold" in line for line in out))
        c = Character.objects.get(pk=c.pk)
        self.assertEqual(c.gold, 10)
        self.assertEqual(c.inventory, [])
        self.assertEqual(
            NpcShopStockLine.objects.filter(
                shop__npc=npc, kind=NpcShopStockLine.Kind.CONSIGNMENT
            ).count(),
            1,
        )

    def test_sell_rejects_unsellable_and_junk(self):
        npc = Npc.objects.create(room=self.room, slug="v", name="Vendor", description="")
        NpcShop.objects.create(npc=npc, enabled=True, sell_price_percent=50)
        c = self._char("P")
        bad = Item.objects.create(slug="q-nps", name="Quest", cost=1, unsellable=True)
        junk = Item.objects.create(
            slug="j-nps",
            name="Junk",
            cost=1,
            vendor_refuses_buy=True,
        )
        i1 = ItemInstance.objects.create(item=bad, owner_character=c, quantity=1)
        i2 = ItemInstance.objects.create(item=junk, owner_character=c, quantity=1)
        c.inventory = [i1.pk, i2.pk]
        c.save(update_fields=["inventory"])
        self.assertIn("can't sell", " ".join(execute_command(c, parse_command("sell quest"))).lower())
        self.assertIn(
            "junk",
            " ".join(execute_command(c, parse_command("sell junk"))).lower(),
        )

    def test_consignment_decay_removes_line(self):
        npc = Npc.objects.create(room=self.room, slug="d", name="Decayer", description="")
        shop = NpcShop.objects.create(npc=npc, enabled=True)
        gem = Item.objects.create(slug="cg-nps", name="Consign Gem", cost=10)
        inst = ItemInstance.objects.create(item=gem, owner_character=None, room=None, quantity=1)
        NpcShopStockLine.objects.create(
            shop=shop,
            item=gem,
            price=5,
            quantity=1,
            sort_order=0,
            kind=NpcShopStockLine.Kind.CONSIGNMENT,
            times_shown_without_sale=0,
            consignment_item_instance=inst,
        )
        c = self._char("W")
        line = NpcShopStockLine.objects.get(consignment_item_instance=inst)
        line_pk = line.pk
        for _ in range(SHOP_DECAY_THRESHOLD):
            browse_shop(c, shop)
        self.assertFalse(NpcShopStockLine.objects.filter(pk=line_pk).exists())
        self.assertFalse(ItemInstance.objects.filter(pk=inst.pk).exists())
        self.assertTrue(Item.objects.filter(pk=gem.pk).exists())

    def test_crafted_skips_decay(self):
        npc = Npc.objects.create(room=self.room, slug="c", name="Crafter", description="")
        shop = NpcShop.objects.create(npc=npc, enabled=True)
        gem = Item.objects.create(slug="cr-nps", name="Craft Gem", cost=10)
        inst = ItemInstance.objects.create(
            item=gem,
            owner_character=None,
            room=None,
            quantity=1,
            is_crafted=True,
        )
        line = NpcShopStockLine.objects.create(
            shop=shop,
            item=gem,
            price=5,
            quantity=1,
            sort_order=0,
            kind=NpcShopStockLine.Kind.CONSIGNMENT,
            times_shown_without_sale=0,
            consignment_item_instance=inst,
        )
        c = self._char("W2")
        for _ in range(SHOP_DECAY_THRESHOLD + 2):
            browse_shop(c, shop)
        line.refresh_from_db()
        self.assertEqual(line.times_shown_without_sale, 0)

    def test_multi_shop_requires_disambiguation(self):
        n1 = Npc.objects.create(room=self.room, slug="a", name="Alice", description="")
        n2 = Npc.objects.create(room=self.room, slug="b", name="Bob", description="")
        NpcShop.objects.create(npc=n1, enabled=True)
        NpcShop.objects.create(npc=n2, enabled=True)
        c = self._char("X")
        out = execute_command(c, parse_command("shop"))
        self.assertTrue(any("which merchant" in m.lower() for m in out))
