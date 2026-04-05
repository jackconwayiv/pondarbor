"""Staff DM endpoints for quests, NPCs, interactables, and bulk JSON."""

from __future__ import annotations

from django.db import IntegrityError
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
    tr = QuestTransition.objects.create(
        quest=quest,
        from_state_id=fs,
        to_state_id=ts,
        requires_item_id=request.data.get("requires_item_id") or None,
        sort_order=max(0, int(request.data.get("sort_order") or 0)),
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


def _interactable_dict(o: Interactable) -> dict:
    return {
        "id": o.id,
        "room_id": o.room_id,
        "slug": o.slug,
        "name": o.name,
        "kind": o.kind,
        "inspect_text": o.inspect_text,
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
        o = Interactable.objects.create(
            room_id=rid,
            slug=slug,
            name=name,
            kind=kind,
            inspect_text=(request.data.get("inspect_text") or "")[:],
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
