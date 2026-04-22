"""NPC shops: list, buy, sell, consignment decay."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Max

from qff.game_helpers import display_name_for_instance, format_item_inspect_parenthetical
from qff.inventory_absorb import absorb_item_quantity
from qff.quest_engine import name_token_prefix_match
from qff.models import Character, ItemInstance, Npc, NpcShop, NpcShopStockLine

SHOP_DECAY_THRESHOLD = 5


def _prepend_inv(inv: list, pk: int) -> list:
    return [pk] + [x for x in inv if x != pk]


def get_enabled_shops_in_room(room_id: int):
    return (
        NpcShop.objects.filter(npc__room_id=room_id, enabled=True)
        .select_related("npc")
        .order_by("npc__name", "id")
    )


def find_npc_in_room_by_query(room_id: int, query: str) -> Npc | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    npcs = Npc.objects.filter(room_id=room_id)
    for n in npcs.order_by("id"):
        if n.name.lower() == q or n.slug.lower() == q:
            return n
    for n in npcs.order_by("id"):
        if n.name.lower().startswith(q) or n.slug.lower().startswith(q):
            return n
    for n in npcs.order_by("id"):
        if name_token_prefix_match(n.name.lower(), q):
            return n
    return None


def resolve_shop(character: Character, npc_query: str) -> tuple[NpcShop | None, str | None]:
    """Return (shop, error_message)."""
    qs = get_enabled_shops_in_room(character.current_room_id)
    n = len(qs)
    if n == 0:
        return None, "There is no shop here."
    q = (npc_query or "").strip()
    if q:
        npc = find_npc_in_room_by_query(character.current_room_id, q)
        if not npc:
            return None, "You don't see that merchant here."
        try:
            shop = npc.shop
        except NpcShop.DoesNotExist:
            return None, f"{npc.name} is not selling anything."
        if not shop.enabled:
            return None, f"{npc.name} is not selling anything right now."
        return shop, None
    if n > 1:
        first = qs.first()
        assert first is not None
        hint = first.npc.name.split()[0] if first.npc.name else "merchant"
        return None, f"Which merchant? Try: shop {hint}"
    shop = qs.first()
    assert shop is not None
    return shop, None


def _consignment_decay(shop: NpcShop) -> None:
    """Increment neglect on consignment lines; remove at threshold (non-crafted only)."""
    with transaction.atomic():
        # of=("self",) so FOR UPDATE only locks the stock-line row; without it,
        # select_related("consignment_item_instance") forces a LEFT OUTER JOIN onto
        # a nullable OneToOne, which Postgres rejects ("FOR UPDATE cannot be applied
        # to the nullable side of an outer join"). SQLite silently ignores `of`.
        for line in (
            NpcShopStockLine.objects.select_for_update(of=("self",))
            .filter(shop=shop, kind=NpcShopStockLine.Kind.CONSIGNMENT)
            .select_related("consignment_item_instance")
        ):
            inst = line.consignment_item_instance
            if not inst or inst.is_crafted:
                continue
            line.times_shown_without_sale += 1
            if line.times_shown_without_sale >= SHOP_DECAY_THRESHOLD:
                inst.delete()
            else:
                line.save(update_fields=["times_shown_without_sale"])


def _format_stats_line(it) -> str:
    parts: list[str] = []
    if it.damage:
        parts.append(f"{it.damage} {it.dmg_type} dmg")
    if it.armor:
        parts.append(f"{it.armor} armor")
    return ", ".join(parts) if parts else "—"


def format_stock_line_row(line: NpcShopStockLine) -> str:
    it = line.item
    qty_s = "-" if line.quantity is None else str(line.quantity)
    if line.kind == NpcShopStockLine.Kind.CONSIGNMENT and line.consignment_item_instance_id:
        inst = line.consignment_item_instance
        label = display_name_for_instance(inst)
        extra = format_item_inspect_parenthetical(it, bool(inst.unlocked))
        stats = _format_stats_line(it)
        return f"  {label} — {stats}{extra} — {line.price} gold — qty {inst.quantity}"
    label = it.name
    extra = format_item_inspect_parenthetical(it, False)
    stats = _format_stats_line(it)
    return f"  {label} — {stats}{extra} — {line.price} gold — stock {qty_s}"


def browse_shop(character: Character, shop: NpcShop) -> list[str]:
    _consignment_decay(shop)
    lines_out: list[str] = []
    w = (shop.welcome_text or "").strip()
    if w:
        lines_out.append(w)
    else:
        lines_out.append(f"{shop.npc.name} shows you their wares.")
    # The play UI has a shop inventory panel; keep browse output short to avoid
    # spamming the action log with full stock dumps.
    if not NpcShopStockLine.objects.filter(shop=shop).exists():
        lines_out.append("There is nothing for sale.")
    return lines_out


def find_stock_line_for_buy(shop: NpcShop, query: str) -> NpcShopStockLine | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    lines = (
        NpcShopStockLine.objects.filter(shop=shop)
        .select_related("item", "consignment_item_instance")
        .order_by("sort_order", "id")
    )
    for sl in lines:
        it = sl.item
        if it.name.lower() == q or it.slug.lower() == q:
            return sl
    for sl in lines:
        it = sl.item
        if it.name.lower().startswith(q) or it.slug.lower().startswith(q):
            return sl
    for sl in lines:
        if sl.kind == NpcShopStockLine.Kind.CONSIGNMENT and sl.consignment_item_instance_id:
            dn = display_name_for_instance(sl.consignment_item_instance).lower()
            if dn == q or dn.startswith(q):
                return sl
    return None


def find_any_shop_line_in_room(character: Character, query: str) -> NpcShopStockLine | None:
    """First shop in the current room (npc name order) whose stock matches ``query``."""
    for shop in get_enabled_shops_in_room(character.current_room_id):
        sl = find_stock_line_for_buy(shop, query)
        if sl is not None:
            return sl
    return None


@transaction.atomic
def purchase_from_shop(character: Character, shop: NpcShop, query: str) -> list[str]:
    line = find_stock_line_for_buy(shop, query)
    if not line:
        return ["You don't see that for sale."]
    price = int(line.price)
    char = Character.objects.select_for_update().get(pk=character.pk)
    # of=("self",) — lock only the stock-line row; consignment_item_instance is a
    # nullable OneToOne (LEFT OUTER JOIN), which Postgres disallows for FOR UPDATE.
    line = NpcShopStockLine.objects.select_for_update(of=("self",)).select_related(
        "item", "consignment_item_instance"
    ).get(pk=line.pk)
    if line.shop_id != shop.pk:
        return ["That item is no longer available."]
    if int(char.gold) < price:
        return ["You can't afford that item!"]
    if line.kind == NpcShopStockLine.Kind.CONSIGNMENT and line.consignment_item_instance_id:
        inst = ItemInstance.objects.select_for_update().get(pk=line.consignment_item_instance_id)
        if inst.owner_character_id is not None:
            return ["That item is no longer available."]
        char.gold = int(char.gold) - price
        inst.owner_character = char
        inst.room = None
        inst.save(update_fields=["owner_character", "room", "updated_at"])
        inv = list(char.inventory or [])
        char.inventory = _prepend_inv(inv, inst.pk)
        char.save(update_fields=["gold", "inventory", "updated_at"])
        line.delete()
        return [f"You buy {display_name_for_instance(inst)} for {price} gold."]
    it = line.item
    if line.quantity is not None and line.quantity < 1:
        return ["That item is sold out."]
    char.gold = int(char.gold) - price
    char.save(update_fields=["gold", "updated_at"])
    _destination_pks, new_pks = absorb_item_quantity(char, it, 1, donor=None)
    char = Character.objects.select_for_update().get(pk=char.pk)
    inv = list(char.inventory or [])
    for pk in reversed(new_pks):
        inv = _prepend_inv(inv, pk)
    char.inventory = inv
    char.save(update_fields=["inventory", "updated_at"])
    if line.quantity is not None:
        line.quantity = int(line.quantity) - 1
        if int(line.quantity) <= 0:
            line.delete()
        else:
            line.save(update_fields=["quantity"])
    return [f"You buy {it.name} for {price} gold."]


@transaction.atomic
def sell_to_shop(
    character: Character, shop: NpcShop, query: str, *, sell_all: bool = False
) -> list[str]:
    q = (query or "").strip().lower()
    if not q:
        return ["Sell what?"]
    char = Character.objects.select_for_update().get(pk=character.pk)
    inst = find_inventory_instance(char, q)
    if not inst:
        return ["You don't have that."]
    it = ItemInstance.objects.select_for_update().select_related("item").get(pk=inst.pk)
    if it.owner_character_id != char.pk:
        return ["You don't have that."]
    item = it.item
    if item.unsellable:
        return ["The shopkeeper doesn't want that."]
    if item.vendor_refuses_buy:
        return ["No one here wants that junk."]
    inv = list(char.inventory or [])
    if it.pk not in inv:
        return ["You don't have that."]
    pct = max(1, min(100, int(shop.sell_price_percent)))
    offer_per_unit = max(0, int(item.cost * pct / 100))

    held = max(1, int(it.quantity or 1))
    if item.stackable and held > 1:
        sale_units = held if sell_all else 1
    else:
        sale_units = 1

    offer_total = int(offer_per_unit) * int(sale_units)

    # Determine listing price (full shop price if it already sells this item).
    listing_price = int(item.cost or 0)
    existing_static = (
        NpcShopStockLine.objects.select_for_update()
        .filter(shop=shop, item_id=item.id, kind=NpcShopStockLine.Kind.STATIC)
        .order_by("sort_order", "id")
        .first()
    )
    if existing_static is not None:
        listing_price = int(existing_static.price)

    # Merge into existing row when possible.
    merged_into: NpcShopStockLine | None = None
    if existing_static is not None:
        merged_into = existing_static
    else:
        merged_into = (
            NpcShopStockLine.objects.select_for_update()
            .filter(
                shop=shop,
                item_id=item.id,
                kind=NpcShopStockLine.Kind.CONSIGNMENT,
                consignment_item_instance_id__isnull=True,
            )
            .order_by("sort_order", "id")
            .first()
        )

    if merged_into is not None:
        # If unlimited, nothing to do for quantity. Otherwise increment.
        if merged_into.quantity is not None:
            merged_into.quantity = int(merged_into.quantity) + int(sale_units)
            merged_into.save(update_fields=["quantity"])
    else:
        max_sort = (
            NpcShopStockLine.objects.filter(shop=shop).aggregate(m=Max("sort_order"))["m"]
            or 0
        )
        NpcShopStockLine.objects.create(
            shop=shop,
            item=item,
            price=max(1, int(listing_price) if int(listing_price) > 0 else 1),
            quantity=max(1, int(sale_units)),
            sort_order=int(max_sort) + 1,
            kind=NpcShopStockLine.Kind.CONSIGNMENT,
            times_shown_without_sale=0,
            consignment_item_instance=None,
        )

    # Remove items from the hero (default 1 unit for stackables).
    if item.stackable and held > sale_units:
        it.quantity = held - int(sale_units)
        it.save(update_fields=["quantity", "updated_at"])
    else:
        char.inventory = [x for x in inv if x != it.pk]
        it.delete()

    char.gold = int(char.gold) + int(offer_total)
    char.save(update_fields=["inventory", "gold", "updated_at"])

    sold_label = item.name if sale_units == 1 else f"{item.name} ×{sale_units}"
    return [f"You sell {sold_label} for {offer_total} gold."]


def find_inventory_instance(char: Character, query: str) -> ItemInstance | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    for iid in char.inventory or []:
        inst = (
            ItemInstance.objects.filter(pk=iid, owner_character_id=char.pk)
            .select_related("item")
            .first()
        )
        if not inst:
            continue
        dn = display_name_for_instance(inst).lower()
        slug = inst.item.slug.lower()
        name = inst.item.name.lower()
        if dn == q or slug == q or name == q:
            return inst
    for iid in char.inventory or []:
        inst = (
            ItemInstance.objects.filter(pk=iid, owner_character_id=char.pk)
            .select_related("item")
            .first()
        )
        if not inst:
            continue
        dn = display_name_for_instance(inst).lower()
        if dn.startswith(q) or inst.item.name.lower().startswith(q):
            return inst
    return None
