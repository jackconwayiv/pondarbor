"""Staff DM endpoints for quests, NPCs, interactables, and bulk JSON."""

from __future__ import annotations

from django.db import IntegrityError
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from rest_framework.permissions import IsAuthenticated
from users.permissions import IsStaffUser

from qff.models import (
    Interactable,
    Item,
    Npc,
    NpcDialogue,
    NpcShop,
    NpcShopStockLine,
    Quest,
    QuestEffect,
    QuestState,
    QuestTransition,
    Room,
)


def _quest_state_dict(qs: QuestState) -> dict:
    return {
        "id": qs.id,
        "slug": qs.slug,
        "name": qs.name,
        "is_initial": qs.is_initial,
        "is_terminal": qs.is_terminal,
        "sort_order": qs.sort_order,
    }


def _quest_effect_dict(eff: QuestEffect) -> dict:
    return {
        "id": eff.id,
        "kind": eff.kind,
        "amount": eff.amount,
        "item_id": eff.item_id,
        "room_exit_id": eff.room_exit_id,
        "sort_order": eff.sort_order,
    }


def _quest_transition_dict(tr: QuestTransition) -> dict:
    return {
        "id": tr.id,
        "from_state_id": tr.from_state_id,
        "to_state_id": tr.to_state_id,
        "requires_item_id": tr.requires_item_id,
        "sort_order": tr.sort_order,
        "revert_after_minutes": tr.revert_after_minutes,
        "revert_to_state_id": tr.revert_to_state_id,
        "effects": [
            _quest_effect_dict(e)
            for e in tr.effects.order_by("sort_order", "id")
        ],
    }


def _quest_detail_dict(quest: Quest) -> dict:
    states = [_quest_state_dict(s) for s in quest.states.order_by("sort_order", "id")]
    transitions = [
        _quest_transition_dict(t)
        for t in QuestTransition.objects.filter(quest=quest)
        .prefetch_related("effects")
        .order_by("sort_order", "id")
    ]
    return {
        "id": quest.id,
        "slug": quest.slug,
        "name": quest.name,
        "description": quest.description,
        "states": states,
        "transitions": transitions,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_list_create(request):
    if request.method == "GET":
        rows = Quest.objects.order_by("name")
        return Response(
            [
                {
                    "id": q.id,
                    "slug": q.slug,
                    "name": q.name,
                    "state_count": q.states.count(),
                }
                for q in rows
            ]
        )
    slug = (request.data.get("slug") or "").strip()[:80]
    name = (request.data.get("name") or "").strip()[:200]
    if not slug or not name:
        return Response(
            {"detail": "slug and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        q = Quest.objects.create(
            slug=slug,
            name=name,
            description=(request.data.get("description") or "")[:],
        )
    except IntegrityError:
        return Response(
            {"detail": "That quest slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_quest_detail_dict(q), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_detail(request, pk):
    quest = get_object_or_404(Quest, pk=pk)
    if request.method == "GET":
        return Response(_quest_detail_dict(quest))
    if request.method == "DELETE":
        quest.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        quest.slug = (request.data.get("slug") or "").strip()[:80]
    if "name" in request.data:
        quest.name = (request.data.get("name") or "").strip()[:200]
    if "description" in request.data:
        quest.description = request.data.get("description") or ""
    try:
        quest.save()
    except IntegrityError:
        return Response(
            {"detail": "That quest slug is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_quest_detail_dict(quest))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_state_create(request, quest_id):
    quest = get_object_or_404(Quest, pk=quest_id)
    slug = (request.data.get("slug") or "").strip()[:80]
    if not slug:
        return Response({"detail": "slug is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        qs = QuestState.objects.create(
            quest=quest,
            slug=slug,
            name=(request.data.get("name") or "")[:200],
            is_initial=bool(request.data.get("is_initial")),
            is_terminal=bool(request.data.get("is_terminal")),
            sort_order=max(0, int(request.data.get("sort_order") or 0)),
        )
    except IntegrityError:
        return Response(
            {"detail": "That state slug is already used for this quest."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_quest_state_dict(qs), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_state_detail(request, pk):
    qs = get_object_or_404(QuestState, pk=pk)
    if request.method == "DELETE":
        qs.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        qs.slug = (request.data.get("slug") or "").strip()[:80]
    if "name" in request.data:
        qs.name = (request.data.get("name") or "")[:200]
    if "is_initial" in request.data:
        qs.is_initial = bool(request.data["is_initial"])
    if "is_terminal" in request.data:
        qs.is_terminal = bool(request.data["is_terminal"])
    if "sort_order" in request.data:
        qs.sort_order = max(0, int(request.data.get("sort_order") or 0))
    try:
        qs.save()
    except IntegrityError:
        return Response(
            {"detail": "That state slug is already used for this quest."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_quest_state_dict(qs))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_transition_create(request, quest_id):
    quest = get_object_or_404(Quest, pk=quest_id)
    fs = request.data.get("from_state_id")
    ts = request.data.get("to_state_id")
    try:
        fs, ts = int(fs), int(ts)
    except (TypeError, ValueError):
        return Response(
            {"detail": "from_state_id and to_state_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fs_obj = get_object_or_404(QuestState, pk=fs)
    ts_obj = get_object_or_404(QuestState, pk=ts)
    if fs_obj.quest_id != quest.id or ts_obj.quest_id != quest.id:
        return Response(
            {"detail": "Both states must belong to this quest."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ram = request.data.get("revert_after_minutes")
    rts = request.data.get("revert_to_state_id")
    tr = QuestTransition.objects.create(
        quest=quest,
        from_state_id=fs,
        to_state_id=ts,
        requires_item_id=request.data.get("requires_item_id") or None,
        sort_order=max(0, int(request.data.get("sort_order") or 0)),
        revert_after_minutes=int(ram) if ram not in (None, "") else None,
        revert_to_state_id=int(rts) if rts not in (None, "") else None,
    )
    return Response(_quest_transition_dict(tr), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_transition_detail(request, pk):
    tr = get_object_or_404(
        QuestTransition.objects.prefetch_related("effects"), pk=pk
    )
    if request.method == "DELETE":
        tr.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "from_state_id" in request.data:
        tr.from_state_id = int(request.data["from_state_id"])
    if "to_state_id" in request.data:
        tr.to_state_id = int(request.data["to_state_id"])
    if "requires_item_id" in request.data:
        tr.requires_item_id = request.data["requires_item_id"] or None
    if "sort_order" in request.data:
        tr.sort_order = max(0, int(request.data.get("sort_order") or 0))
    if "revert_after_minutes" in request.data:
        v = request.data.get("revert_after_minutes")
        tr.revert_after_minutes = int(v) if v not in (None, "") else None
    if "revert_to_state_id" in request.data:
        tr.revert_to_state_id = request.data.get("revert_to_state_id") or None
    tr.save()
    return Response(_quest_transition_dict(tr))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_effect_create(request, transition_id):
    tr = get_object_or_404(QuestTransition, pk=transition_id)
    kind = (request.data.get("kind") or "").strip()
    valid = {k[0] for k in QuestEffect.Kind.choices}
    if kind not in valid:
        return Response({"detail": "invalid kind."}, status=status.HTTP_400_BAD_REQUEST)
    eff = QuestEffect.objects.create(
        transition=tr,
        kind=kind,
        amount=int(request.data.get("amount") or 0),
        item_id=request.data.get("item_id") or None,
        room_exit_id=request.data.get("room_exit_id") or None,
        sort_order=max(0, int(request.data.get("sort_order") or 0)),
    )
    return Response(_quest_effect_dict(eff), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_effect_detail(request, pk):
    eff = get_object_or_404(QuestEffect, pk=pk)
    if request.method == "DELETE":
        eff.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "kind" in request.data:
        eff.kind = request.data["kind"]
    if "amount" in request.data:
        eff.amount = int(request.data.get("amount") or 0)
    if "item_id" in request.data:
        eff.item_id = request.data["item_id"] or None
    if "room_exit_id" in request.data:
        eff.room_exit_id = request.data["room_exit_id"] or None
    if "sort_order" in request.data:
        eff.sort_order = max(0, int(request.data.get("sort_order") or 0))
    eff.save()
    return Response(_quest_effect_dict(eff))


def _npc_dict(npc: Npc, dialogues: bool = False) -> dict:
    out = {
        "id": npc.id,
        "room_id": npc.room_id,
        "slug": npc.slug,
        "name": npc.name,
        "description": npc.description,
        "is_trainer": npc.is_trainer,
        "is_healer": npc.is_healer,
        "is_innkeeper": npc.is_innkeeper,
        "healing_cost": int(npc.healing_cost or 0),
    }
    if dialogues:
        out["dialogues"] = [
            {
                "id": d.id,
                "quest_id": d.quest_id,
                "quest_state_id": d.quest_state_id,
                "priority": d.priority,
                "text": d.text,
            }
            for d in npc.dialogues.order_by("-priority", "id")
        ]
    return out


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_list_create(request):
    room_id = request.query_params.get("room_id")
    if request.method == "GET":
        qs = Npc.objects.select_related("room").order_by("room_id", "name")
        if room_id:
            qs = qs.filter(room_id=int(room_id))
        return Response([_npc_dict(n) for n in qs])
    slug = (request.data.get("slug") or "").strip()[:80]
    name = (request.data.get("name") or "").strip()[:200]
    rid = request.data.get("room_id")
    try:
        rid = int(rid)
    except (TypeError, ValueError):
        rid = None
    if not slug or not name or not rid:
        return Response(
            {"detail": "room_id, slug, and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    get_object_or_404(Room, pk=rid)
    try:
        npc = Npc.objects.create(
            room_id=rid,
            slug=slug,
            name=name,
            description=(request.data.get("description") or "")[:],
            is_trainer=bool(request.data.get("is_trainer")),
            is_healer=bool(request.data.get("is_healer")),
            is_innkeeper=bool(request.data.get("is_innkeeper")),
            healing_cost=max(0, int(request.data.get("healing_cost") or 0)),
        )
    except IntegrityError:
        return Response(
            {"detail": "That NPC slug is already used in this room."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_npc_dict(npc), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_detail(request, pk):
    npc = get_object_or_404(Npc.objects.prefetch_related("dialogues"), pk=pk)
    if request.method == "GET":
        return Response(_npc_dict(npc, dialogues=True))
    if request.method == "DELETE":
        npc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        npc.slug = (request.data.get("slug") or "").strip()[:80]
    if "name" in request.data:
        npc.name = (request.data.get("name") or "").strip()[:200]
    if "description" in request.data:
        npc.description = request.data.get("description") or ""
    if "is_trainer" in request.data:
        npc.is_trainer = bool(request.data["is_trainer"])
    if "is_healer" in request.data:
        npc.is_healer = bool(request.data["is_healer"])
    if "is_innkeeper" in request.data:
        npc.is_innkeeper = bool(request.data["is_innkeeper"])
    if "healing_cost" in request.data:
        try:
            npc.healing_cost = max(0, int(request.data["healing_cost"] or 0))
        except (TypeError, ValueError):
            npc.healing_cost = 0
    if "room_id" in request.data:
        get_object_or_404(Room, pk=int(request.data["room_id"]))
        npc.room_id = int(request.data["room_id"])
    try:
        npc.save()
    except IntegrityError:
        return Response(
            {"detail": "That NPC slug is already used in this room."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_npc_dict(npc, dialogues=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_dialogue_create(request, npc_id):
    npc = get_object_or_404(Npc, pk=npc_id)
    text = (request.data.get("text") or "").strip()
    if not text:
        return Response({"detail": "text is required."}, status=status.HTTP_400_BAD_REQUEST)
    d = NpcDialogue.objects.create(
        npc=npc,
        quest_id=request.data.get("quest_id") or None,
        quest_state_id=request.data.get("quest_state_id") or None,
        priority=max(0, int(request.data.get("priority") or 0)),
        text=text[:],
    )
    return Response(
        {
            "id": d.id,
            "quest_id": d.quest_id,
            "quest_state_id": d.quest_state_id,
            "priority": d.priority,
            "text": d.text,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_dialogue_detail(request, pk):
    d = get_object_or_404(NpcDialogue, pk=pk)
    if request.method == "DELETE":
        d.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "text" in request.data:
        d.text = (request.data.get("text") or "")[:]
    if "quest_id" in request.data:
        d.quest_id = request.data["quest_id"] or None
    if "quest_state_id" in request.data:
        d.quest_state_id = request.data["quest_state_id"] or None
    if "priority" in request.data:
        d.priority = max(0, int(request.data.get("priority") or 0))
    d.save()
    return Response(
        {
            "id": d.id,
            "quest_id": d.quest_id,
            "quest_state_id": d.quest_state_id,
            "priority": d.priority,
            "text": d.text,
        }
    )


def _dm_npc_shop_stock_line_dict(sl: NpcShopStockLine) -> dict:
    return {
        "id": sl.id,
        "item_id": sl.item_id,
        "item_name": sl.item.name,
        "item_slug": sl.item.slug,
        "price": sl.price,
        "quantity": sl.quantity,
        "sort_order": sl.sort_order,
        "kind": sl.kind,
        "times_shown_without_sale": sl.times_shown_without_sale,
        "consignment_item_instance_id": sl.consignment_item_instance_id,
    }


def _dm_npc_shop_dict(shop: NpcShop) -> dict:
    lines = [
        _dm_npc_shop_stock_line_dict(sl)
        for sl in shop.stock_lines.select_related("item").order_by("sort_order", "id")
    ]
    return {
        "id": shop.id,
        "npc_id": shop.npc_id,
        "welcome_text": shop.welcome_text,
        "enabled": shop.enabled,
        "sell_price_percent": shop.sell_price_percent,
        "stock_lines": lines,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_shop_picker(request):
    """NPC list for shop editor (room / area labels; has_shop flag)."""
    shop_exists = NpcShop.objects.filter(npc_id=OuterRef("pk"))
    qs = (
        Npc.objects.select_related("room", "room__area")
        .annotate(has_shop=Exists(shop_exists))
        .order_by("room_id", "name")
    )
    rows = []
    for n in qs:
        rows.append(
            {
                "id": n.id,
                "slug": n.slug,
                "name": n.name,
                "room_id": n.room_id,
                "room_name": n.room.name,
                "area_name": n.room.area.name,
                "has_shop": n.has_shop,
            }
        )
    return Response(rows)


@api_view(["GET", "POST", "PATCH"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_shop_by_npc(request, npc_id):
    npc = get_object_or_404(Npc.objects.select_related("room"), pk=npc_id)
    if request.method == "GET":
        shop = (
            NpcShop.objects.filter(npc=npc)
            .prefetch_related("stock_lines__item")
            .first()
        )
        if not shop:
            return Response({"detail": "No shop for this NPC."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_dm_npc_shop_dict(shop))
    if request.method == "POST":
        if NpcShop.objects.filter(npc=npc).exists():
            return Response(
                {"detail": "This NPC already has a shop."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shop = NpcShop.objects.create(
            npc=npc,
            welcome_text=(request.data.get("welcome_text") or "")[:],
            enabled=bool(request.data.get("enabled", True)),
            sell_price_percent=max(1, min(100, int(request.data.get("sell_price_percent") or 50))),
        )
        shop = NpcShop.objects.prefetch_related("stock_lines__item").get(pk=shop.pk)
        return Response(_dm_npc_shop_dict(shop), status=status.HTTP_201_CREATED)
    shop = NpcShop.objects.filter(npc=npc).first()
    if not shop:
        return Response({"detail": "No shop for this NPC."}, status=status.HTTP_404_NOT_FOUND)
    if "welcome_text" in request.data:
        shop.welcome_text = request.data.get("welcome_text") or ""
    if "enabled" in request.data:
        shop.enabled = bool(request.data["enabled"])
    if "sell_price_percent" in request.data:
        shop.sell_price_percent = max(1, min(100, int(request.data.get("sell_price_percent") or 50)))
    shop.save()
    shop = NpcShop.objects.prefetch_related("stock_lines__item").get(pk=shop.pk)
    return Response(_dm_npc_shop_dict(shop))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_shop_stock_line_create(request, npc_id):
    npc = get_object_or_404(Npc, pk=npc_id)
    shop = get_object_or_404(NpcShop, npc=npc)
    kind = str(request.data.get("kind") or NpcShopStockLine.Kind.STATIC).strip()
    if kind != NpcShopStockLine.Kind.STATIC:
        return Response(
            {"detail": "Only static stock lines can be created from the DM UI."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    item_id = request.data.get("item_id")
    try:
        item_id = int(item_id)
    except (TypeError, ValueError):
        return Response({"detail": "item_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    get_object_or_404(Item, pk=item_id)
    price = max(1, int(request.data.get("price") or 0))
    qty_raw = request.data.get("quantity")
    quantity = None if qty_raw in (None, "", "unlimited") else max(1, int(qty_raw))
    sort_order = max(0, int(request.data.get("sort_order") or 0))
    line = NpcShopStockLine.objects.create(
        shop=shop,
        item_id=item_id,
        price=price,
        quantity=quantity,
        sort_order=sort_order,
        kind=NpcShopStockLine.Kind.STATIC,
        times_shown_without_sale=0,
        consignment_item_instance=None,
    )
    line = NpcShopStockLine.objects.select_related("item").get(pk=line.pk)
    return Response(_dm_npc_shop_stock_line_dict(line), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_npc_shop_stock_line_detail(request, pk):
    line = get_object_or_404(
        NpcShopStockLine.objects.select_related("shop", "item", "consignment_item_instance"),
        pk=pk,
    )
    if request.method == "DELETE":
        if line.consignment_item_instance_id:
            line.consignment_item_instance.delete()
        else:
            line.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "item_id" in request.data:
        iid = int(request.data["item_id"])
        get_object_or_404(Item, pk=iid)
        line.item_id = iid
    if "price" in request.data:
        line.price = max(1, int(request.data.get("price") or 0))
    if "quantity" in request.data:
        qty_raw = request.data.get("quantity")
        line.quantity = None if qty_raw in (None, "", "unlimited") else max(1, int(qty_raw))
    if "sort_order" in request.data:
        line.sort_order = max(0, int(request.data.get("sort_order") or 0))
    if line.kind == NpcShopStockLine.Kind.STATIC:
        line.save()
        line = NpcShopStockLine.objects.select_related("item").get(pk=line.pk)
        return Response(_dm_npc_shop_stock_line_dict(line))
    return Response(
        {"detail": "Consignment lines are managed by gameplay; delete instead of editing."},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _interactable_dict(o: Interactable) -> dict:
    return {
        "id": o.id,
        "room_id": o.room_id,
        "slug": o.slug,
        "name": o.name,
        "kind": o.kind,
        "inspect_text": o.inspect_text,
        "read_text": o.read_text,
        "map_reveal_minutes": o.map_reveal_minutes,
        "quest_transition_id": o.quest_transition_id,
        "unlocks_exit_id": o.unlocks_exit_id,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_interactable_list_create(request):
    room_id = request.query_params.get("room_id")
    if request.method == "GET":
        qs = Interactable.objects.order_by("room_id", "name")
        if room_id:
            qs = qs.filter(room_id=int(room_id))
        return Response([_interactable_dict(o) for o in qs])
    slug = (request.data.get("slug") or "").strip()[:80]
    name = (request.data.get("name") or "").strip()[:200]
    rid = request.data.get("room_id")
    try:
        rid = int(rid)
    except (TypeError, ValueError):
        rid = None
    if not slug or not name or not rid:
        return Response(
            {"detail": "room_id, slug, and name are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    get_object_or_404(Room, pk=rid)
    kind = (request.data.get("kind") or Interactable.Kind.OTHER).strip()
    try:
        mm = request.data.get("map_reveal_minutes")
        o = Interactable.objects.create(
            room_id=rid,
            slug=slug,
            name=name,
            kind=kind,
            inspect_text=(request.data.get("inspect_text") or "")[:],
            read_text=(request.data.get("read_text") or "")[:],
            map_reveal_minutes=int(mm) if mm not in (None, "") else None,
            quest_transition_id=request.data.get("quest_transition_id") or None,
            unlocks_exit_id=request.data.get("unlocks_exit_id") or None,
        )
    except IntegrityError:
        return Response(
            {"detail": "That interactable slug is already used in this room."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_interactable_dict(o), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_interactable_detail(request, pk):
    o = get_object_or_404(Interactable, pk=pk)
    if request.method == "GET":
        return Response(_interactable_dict(o))
    if request.method == "DELETE":
        o.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if "slug" in request.data:
        o.slug = (request.data.get("slug") or "").strip()[:80]
    if "name" in request.data:
        o.name = (request.data.get("name") or "").strip()[:200]
    if "kind" in request.data:
        o.kind = request.data["kind"]
    if "inspect_text" in request.data:
        o.inspect_text = request.data.get("inspect_text") or ""
    if "read_text" in request.data:
        o.read_text = request.data.get("read_text") or ""
    if "map_reveal_minutes" in request.data:
        v = request.data.get("map_reveal_minutes")
        o.map_reveal_minutes = int(v) if v not in (None, "") else None
    if "room_id" in request.data:
        get_object_or_404(Room, pk=int(request.data["room_id"]))
        o.room_id = int(request.data["room_id"])
    if "quest_transition_id" in request.data:
        o.quest_transition_id = request.data["quest_transition_id"] or None
    if "unlocks_exit_id" in request.data:
        o.unlocks_exit_id = request.data["unlocks_exit_id"] or None
    try:
        o.save()
    except IntegrityError:
        return Response(
            {"detail": "That interactable slug is already used in this room."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(_interactable_dict(o))


# --- Bulk JSON export (GET) ---


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_items_export_json(request):
    from qff.views import _dm_item_dict

    return Response(
        {
            "version": 1,
            "format": "qff-items",
            "items": [_dm_item_dict(i) for i in Item.objects.order_by("id")],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_classes_export_json(request):
    from qff.models import CharacterClass
    from qff.views import _dm_class_dict

    return Response(
        {
            "version": 1,
            "format": "qff-classes",
            "classes": [
                _dm_class_dict(c) for c in CharacterClass.objects.order_by("sort_order", "id")
            ],
        }
    )


def _npc_export_dict(npc: Npc) -> dict:
    return {
        "room_id": npc.room_id,
        "slug": npc.slug,
        "name": npc.name,
        "description": npc.description,
        "dialogues": [
            {
                "quest_slug": d.quest.slug if d.quest_id else None,
                "quest_state_slug": d.quest_state.slug if d.quest_state_id else None,
                "priority": d.priority,
                "text": d.text,
            }
            for d in npc.dialogues.select_related("quest", "quest_state").order_by(
                "-priority", "id"
            )
        ],
    }


def _interactable_export_dict(o: Interactable) -> dict:
    return {
        "room_id": o.room_id,
        "slug": o.slug,
        "name": o.name,
        "kind": o.kind,
        "inspect_text": o.inspect_text,
        "read_text": o.read_text,
        "map_reveal_minutes": o.map_reveal_minutes,
        "quest_transition_hint": (
            {
                "quest_slug": o.quest_transition.quest.slug,
                "from_state_slug": o.quest_transition.from_state.slug,
                "to_state_slug": o.quest_transition.to_state.slug,
            }
            if o.quest_transition_id
            else None
        ),
        "unlocks_exit_id": o.unlocks_exit_id,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def dm_quest_world_export_json(request):
    """Quests + NPCs + interactables."""
    quests = [
        _quest_detail_dict(q)
        for q in Quest.objects.order_by("id").prefetch_related("states")
    ]
    npcs = [
        _npc_export_dict(n)
        for n in Npc.objects.order_by("id").prefetch_related(
            "dialogues__quest", "dialogues__quest_state"
        )
    ]
    interactables = [
        _interactable_export_dict(o)
        for o in Interactable.objects.order_by("id").select_related(
            "quest_transition__quest",
            "quest_transition__from_state",
            "quest_transition__to_state",
        )
    ]
    return Response(
        {
            "version": 1,
            "format": "qff-quest-world",
            "quests": quests,
            "npcs": npcs,
            "interactables": interactables,
        }
    )
