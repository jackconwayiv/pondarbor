import json
import logging
import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_204_NO_CONTENT

from closet.constants import CANONICAL_CLOSET_CATEGORIES, FRIENDS_ITEMS_CATEGORY_OTHER
from closet.models import BorrowRequest, Item, Loan
from closet.serializers import (
    BorrowRequestCreateSerializer,
    BorrowRequestSerializer,
    ItemCreateSerializer,
    ItemPatchSerializer,
    ItemSerializer,
    LoanSerializer,
)
from closet.services import (
    item_fk_owner_publication_eligible_q,
    owner_eligible_for_closet_publication_q,
)
from friends.services import are_friends, friend_ids_for_user
from users.permissions import IsApprovedUser

User = get_user_model()

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid integer for %s=%r; using default %s", name, raw, default)
        return default


def _active_loan_for_item(item: Item):
    return (
        item.loans.filter(status=Loan.Status.ACTIVE, deleted_at__isnull=True)
        .select_related("owner_user", "borrower_user")
        .first()
    )


def _item_queryset():
    return (
        Item.objects.filter(deleted_at__isnull=True)
        .filter(owner_eligible_for_closet_publication_q())
        .select_related(
            "owner_user__profile",
            "current_holder_user__profile",
            "custody_pending_acceptance_user__profile",
        )
    )


def _visible_borrow_requests():
    return BorrowRequest.objects.filter(deleted_at__isnull=True)


def _visible_loans():
    return Loan.objects.filter(deleted_at__isnull=True)


FRIENDS_ITEMS_SORT_FIELDS = {
    "updated_desc": ("-updated_at", "-id"),
    "updated_asc": ("updated_at", "id"),
    "created_desc": ("-created_at", "-id"),
    "created_asc": ("created_at", "id"),
    "name_asc": ("name", "id"),
    "name_desc": ("-name", "-id"),
}


def _coerce_tags_list(raw) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError, ValueError):
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _friends_items_filter_by_tag(qs, tag_needle: str):
    """Filter queryset to items with any tag containing tag_needle (case-insensitive substring)."""
    tag_cf = tag_needle.casefold()
    matching_ids = []
    for pk, tgs in qs.values_list("id", "tags"):
        tags_list = _coerce_tags_list(tgs)
        if any(isinstance(t, str) and tag_cf in t.casefold() for t in tags_list):
            matching_ids.append(pk)
    return qs.filter(id__in=matching_ids)


def _friends_items_filter_by_preset_category(qs, category: str):
    """
    Preset/custom category string: match trimmed category field (case-insensitive) OR any tag
    that equals the same string (case-insensitive). Covers items where the preset was stored as a tag.
    """
    needle = category.strip().casefold()
    if not needle:
        return qs
    matching_ids: set[int] = set()
    for pk, cat_val, tgs in qs.values_list("id", "category", "tags"):
        if isinstance(cat_val, str) and cat_val.strip().casefold() == needle:
            matching_ids.add(pk)
            continue
        for t in _coerce_tags_list(tgs):
            if isinstance(t, str) and t.strip().casefold() == needle:
                matching_ids.add(pk)
                break
    return qs.filter(id__in=matching_ids)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "closet", "ok": True})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def closet_action_summary(request):
    user = request.user
    incoming_borrows = _visible_borrow_requests().filter(
        status=BorrowRequest.Status.PENDING,
        item__owner_user_id=user.id,
        item__deleted_at__isnull=True,
    ).count()
    custody_disputes = Item.objects.filter(
        owner_user_id=user.id,
        deleted_at__isnull=True,
        custody_disputed=True,
    ).count()
    loan_returns_waiting = _visible_loans().filter(
        status=Loan.Status.ACTIVE,
        owner_user_id=user.id,
        marked_returned_by_borrower_at__isnull=False,
        item__deleted_at__isnull=True,
    ).count()
    active_loan_exists = Loan.objects.filter(
        item_id=OuterRef("pk"),
        status=Loan.Status.ACTIVE,
        deleted_at__isnull=True,
    )
    custody_handoff_waiting = (
        Item.objects.filter(
            owner_user_id=user.id,
            deleted_at__isnull=True,
            custody_marked_returned_by_holder_at__isnull=False,
        )
        .annotate(_has_active_loan=Exists(active_loan_exists))
        .filter(_has_active_loan=False)
        .count()
    )
    custody_invites = (
        Item.objects.filter(
            custody_pending_acceptance_user_id=user.id,
            deleted_at__isnull=True,
        )
        .filter(owner_eligible_for_closet_publication_q())
        .count()
    )
    total = (
        incoming_borrows
        + custody_disputes
        + loan_returns_waiting
        + custody_handoff_waiting
        + custody_invites
    )
    return Response({"outstanding_actions_count": total})


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def items_mine(request):
    if request.method == "POST":
        serializer = ItemCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(ItemSerializer(item, context={"request": request}).data, status=HTTP_201_CREATED)

    user = request.user
    base_qs = _item_queryset()
    borrowed_by_me_qs = base_qs.filter(current_holder_user=user).exclude(owner_user=user).order_by("-updated_at")
    borrowed_ids = list(borrowed_by_me_qs.values_list("id", flat=True))

    custody_offered_qs = (
        base_qs.filter(custody_pending_acceptance_user=user).exclude(owner_user=user).order_by("-updated_at")
    )
    custody_offered_ids = set(custody_offered_qs.values_list("id", flat=True))

    requested_rows = _visible_borrow_requests().filter(
        requester_user=user,
        status=BorrowRequest.Status.PENDING,
        item__deleted_at__isnull=True,
    ).filter(item_fk_owner_publication_eligible_q()).select_related(
        "item",
        "item__owner_user__profile",
        "item__current_holder_user__profile",
        "item__custody_pending_acceptance_user__profile",
    )
    requested_items = []
    seen_requested = set()
    for row in requested_rows:
        item = row.item
        if item.id in borrowed_ids or item.id in custody_offered_ids or item.id in seen_requested:
            continue
        seen_requested.add(item.id)
        requested_items.append(item)

    declined_rows = (
        _visible_borrow_requests()
        .filter(
            requester_user=user,
            status=BorrowRequest.Status.DECLINED,
            item__deleted_at__isnull=True,
        )
        .filter(item_fk_owner_publication_eligible_q())
        .select_related(
            "item",
            "item__owner_user__profile",
            "item__current_holder_user__profile",
            "item__custody_pending_acceptance_user__profile",
        )
        .order_by("-responded_at", "-updated_at", "-created_at")
    )
    declined_items = []
    seen_declined = set()
    for row in declined_rows:
        item = row.item
        if (
            item.id in borrowed_ids
            or item.id in custody_offered_ids
            or item.id in seen_requested
            or item.id in seen_declined
        ):
            continue
        seen_declined.add(item.id)
        declined_items.append(item)

    owned_qs = (
        base_qs.filter(owner_user=user)
        .exclude(id__in=borrowed_ids)
        .exclude(id__in=seen_requested)
        .exclude(id__in=seen_declined)
        .order_by("-updated_at")
    )
    return Response(
        {
            "declined_by_me": ItemSerializer(declined_items, many=True, context={"request": request}).data,
            "borrowed_by_me": ItemSerializer(borrowed_by_me_qs, many=True, context={"request": request}).data,
            "custody_offered_to_me": ItemSerializer(custody_offered_qs, many=True, context={"request": request}).data,
            "requested_by_me": ItemSerializer(requested_items, many=True, context={"request": request}).data,
            "owned_by_me": ItemSerializer(owned_qs, many=True, context={"request": request}).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def items_friends(request):
    user = request.user
    friend_ids = friend_ids_for_user(user=user)
    qs = _item_queryset().filter(owner_user_id__in=friend_ids).exclude(owner_user=user)

    category = (request.query_params.get("category") or "").strip()
    if category:
        if category.casefold() == FRIENDS_ITEMS_CATEGORY_OTHER.casefold():
            for preset in CANONICAL_CLOSET_CATEGORIES:
                qs = qs.exclude(category__iexact=preset)
            qs = qs.exclude(category__exact="")
        else:
            qs = _friends_items_filter_by_preset_category(qs, category)

    tag = (request.query_params.get("tag") or "").strip()
    if tag:
        qs = _friends_items_filter_by_tag(qs, tag)

    sort_key = (request.query_params.get("sort") or "updated_desc").strip()
    order = FRIENDS_ITEMS_SORT_FIELDS.get(sort_key, FRIENDS_ITEMS_SORT_FIELDS["updated_desc"])
    qs = qs.order_by(*order)

    page = max(1, int(request.query_params.get("page", "1")))
    page_size = min(50, max(1, int(request.query_params.get("page_size", "10"))))
    start = (page - 1) * page_size
    end = start + page_size
    total = qs.count()
    rows = list(qs[start:end])
    return Response(
        {
            "results": ItemSerializer(rows, many=True, context={"request": request}).data,
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_next": end < total,
            "has_prev": page > 1,
        }
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsApprovedUser])
def item_detail(request, item_id: int):
    user = request.user
    qs = _item_queryset().filter(
        Q(owner_user=user)
        | Q(current_holder_user=user)
        | Q(custody_pending_acceptance_user=user)
        | Q(owner_user_id__in=friend_ids_for_user(user=user))
    )
    item = get_object_or_404(qs, id=item_id)

    if request.method == "GET":
        return Response(ItemSerializer(item, context={"request": request}).data)

    if item.owner_user_id != user.id:
        return Response({"detail": "Only the owner can modify this item."}, status=403)

    if request.method == "PATCH":
        serializer = ItemPatchSerializer(
            item,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ItemSerializer(item, context={"request": request}).data)

    item.deleted_at = timezone.now()
    item.save(update_fields=["deleted_at", "updated_at"])
    return Response(status=HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def borrow_request_create(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    serializer = BorrowRequestCreateSerializer(
        data=request.data,
        context={"request": request, "item": item},
    )
    serializer.is_valid(raise_exception=True)
    row = serializer.save()
    return Response(BorrowRequestSerializer(row).data, status=HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def item_borrow_requests(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if user.id not in (item.owner_user_id, item.current_holder_user_id):
        return Response({"detail": "Only the owner or current holder can view requests."}, status=403)
    qs = (
        item.borrow_requests.filter(deleted_at__isnull=True)
        .select_related("requester_user__profile")
        .order_by("status", "date_needed_by", "-created_at")
    )
    return Response(BorrowRequestSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def borrow_request_approve(request, borrow_request_id: int):
    user = request.user
    row = get_object_or_404(
        _visible_borrow_requests().select_related("item", "requester_user", "item__owner_user"),
        id=borrow_request_id,
    )
    if row.item.owner_user_id != user.id:
        return Response({"detail": "Only owner can approve requests."}, status=403)
    if row.status != BorrowRequest.Status.PENDING:
        return Response({"detail": "Request is no longer pending."}, status=400)
    if _active_loan_for_item(row.item):
        return Response({"detail": "Item already has an active loan."}, status=400)

    row.status = BorrowRequest.Status.APPROVED
    row.responded_at = timezone.now()
    row.save(update_fields=["status", "responded_at", "updated_at"])

    loan = Loan.objects.create(
        item=row.item,
        owner_user=row.item.owner_user,
        borrower_user=row.requester_user,
        approved_request=row,
        status=Loan.Status.ACTIVE,
    )
    row.item.current_holder_user = row.requester_user
    row.item.custody_disputed = False
    row.item.custody_marked_returned_by_holder_at = None
    row.item.custody_pending_acceptance_user = None
    row.item.save(
        update_fields=[
            "current_holder_user",
            "custody_disputed",
            "custody_marked_returned_by_holder_at",
            "custody_pending_acceptance_user",
            "updated_at",
        ]
    )
    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def borrow_request_decline(request, borrow_request_id: int):
    user = request.user
    row = get_object_or_404(_visible_borrow_requests().select_related("item"), id=borrow_request_id)
    if row.item.owner_user_id != user.id:
        return Response({"detail": "Only owner can decline requests."}, status=403)
    if row.status != BorrowRequest.Status.PENDING:
        return Response({"detail": "Request is no longer pending."}, status=400)
    decline_message = request.data.get("decline_message", "")
    if decline_message is None:
        decline_message = ""
    decline_message = str(decline_message).strip()
    row.status = BorrowRequest.Status.DECLINED
    row.decline_message = decline_message
    row.responded_at = timezone.now()
    row.save(update_fields=["status", "decline_message", "responded_at", "updated_at"])
    return Response(BorrowRequestSerializer(row).data)


@api_view(["DELETE"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def borrow_request_delete(request, borrow_request_id: int):
    user = request.user
    row = get_object_or_404(_visible_borrow_requests(), id=borrow_request_id)
    if row.requester_user_id != user.id:
        return Response({"detail": "Only requester can delete this request."}, status=403)
    if row.status != BorrowRequest.Status.DECLINED:
        return Response({"detail": "Only declined requests can be deleted."}, status=400)
    row.delete()
    return Response(status=HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def borrow_request_cancel(request, borrow_request_id: int):
    user = request.user
    row = get_object_or_404(_visible_borrow_requests(), id=borrow_request_id)
    if row.requester_user_id != user.id:
        return Response({"detail": "Only requester can cancel this request."}, status=403)
    if row.status != BorrowRequest.Status.PENDING:
        return Response({"detail": "Only pending requests can be canceled."}, status=400)
    row.status = BorrowRequest.Status.CANCELED
    row.responded_at = timezone.now()
    row.save(update_fields=["status", "responded_at", "updated_at"])
    return Response(BorrowRequestSerializer(row).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def loan_mark_returned_by_borrower(request, loan_id: int):
    loan = get_object_or_404(
        _visible_loans().select_related("item", "borrower_user", "owner_user"),
        id=loan_id,
    )
    if loan.borrower_user_id != request.user.id:
        return Response({"detail": "Only borrower can mark returned-by-borrower."}, status=403)
    if loan.status != Loan.Status.ACTIVE:
        return Response({"detail": "Only active loans can be marked."}, status=400)
    if loan.marked_returned_by_borrower_at is None:
        loan.marked_returned_by_borrower_at = timezone.now()
        loan.save(update_fields=["marked_returned_by_borrower_at"])
    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def loan_mark_returned(request, loan_id: int):
    loan = get_object_or_404(
        _visible_loans().select_related("item", "owner_user", "borrower_user"),
        id=loan_id,
    )
    if loan.owner_user_id != request.user.id:
        return Response({"detail": "Only owner can mark returned."}, status=403)
    if loan.status != Loan.Status.ACTIVE:
        return Response({"detail": "Loan is not active."}, status=400)

    now = timezone.now()
    loan.marked_returned_by_owner_at = now
    loan.returned_at = now
    loan.status = Loan.Status.RETURNED
    loan.save(update_fields=["marked_returned_by_owner_at", "returned_at", "status"])

    loan.item.current_holder_user = loan.owner_user
    loan.item.custody_disputed = False
    loan.item.custody_marked_returned_by_holder_at = None
    loan.item.custody_pending_acceptance_user = None
    loan.item.save(
        update_fields=[
            "current_holder_user",
            "custody_disputed",
            "custody_marked_returned_by_holder_at",
            "custody_pending_acceptance_user",
            "updated_at",
        ]
    )
    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_set_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.owner_user_id != user.id:
        return Response({"detail": "Only owner can set custody."}, status=403)
    holder_user_id = request.data.get("holder_user_id")
    if holder_user_id is None:
        return Response({"detail": "holder_user_id is required."}, status=400)
    holder = get_object_or_404(User.objects.select_related("profile"), id=holder_user_id)
    if holder.id != user.id and not are_friends(user_a=user, user_b=holder):
        return Response({"detail": "Owner can only assign custody to self or a friend."}, status=400)
    if holder.id == user.id:
        item.current_holder_user = user
        item.custody_pending_acceptance_user = None
        item.custody_disputed = False
        item.custody_marked_returned_by_holder_at = None
        item.save(
            update_fields=[
                "current_holder_user",
                "custody_pending_acceptance_user",
                "custody_disputed",
                "custody_marked_returned_by_holder_at",
                "updated_at",
            ]
        )
    else:
        item.custody_pending_acceptance_user = holder
        item.custody_disputed = False
        item.custody_marked_returned_by_holder_at = None
        item.save(
            update_fields=[
                "custody_pending_acceptance_user",
                "custody_disputed",
                "custody_marked_returned_by_holder_at",
                "updated_at",
            ]
        )
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_deny_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.current_holder_user_id != user.id:
        return Response({"detail": "Only current holder can deny custody."}, status=403)
    item.custody_disputed = True
    item.custody_marked_returned_by_holder_at = None
    item.custody_pending_acceptance_user = None
    item.save(
        update_fields=[
            "custody_disputed",
            "custody_marked_returned_by_holder_at",
            "custody_pending_acceptance_user",
            "updated_at",
        ]
    )
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_accept_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.custody_pending_acceptance_user_id != user.id:
        return Response({"detail": "You do not have a pending custody offer for this item."}, status=403)
    if not are_friends(user_a=user, user_b=item.owner_user):
        return Response({"detail": "You can only accept custody from friends."}, status=400)
    item.current_holder_user = user
    item.custody_pending_acceptance_user = None
    item.custody_disputed = False
    item.custody_marked_returned_by_holder_at = None
    item.save(
        update_fields=[
            "current_holder_user",
            "custody_pending_acceptance_user",
            "custody_disputed",
            "custody_marked_returned_by_holder_at",
            "updated_at",
        ]
    )
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_reject_pending_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.custody_pending_acceptance_user_id != user.id:
        return Response({"detail": "You do not have a pending custody offer for this item."}, status=403)
    item.custody_pending_acceptance_user = None
    item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_cancel_pending_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.owner_user_id != user.id:
        return Response({"detail": "Only the owner can cancel a pending custody offer."}, status=403)
    if item.custody_pending_acceptance_user_id is None:
        return Response({"detail": "There is no pending custody offer for this item."}, status=400)
    item.custody_pending_acceptance_user = None
    item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_mark_custody_returned_by_holder(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.current_holder_user_id != user.id:
        return Response({"detail": "Only the current holder can mark a custody return."}, status=403)
    if item.owner_user_id == user.id:
        return Response({"detail": "You already have custody as the owner."}, status=400)
    if _active_loan_for_item(item):
        return Response(
            {"detail": "This item has an active loan. Use the loan return flow instead."},
            status=400,
        )
    if not are_friends(user_a=user, user_b=item.owner_user):
        return Response({"detail": "You can only update items from friends."}, status=400)
    if item.custody_marked_returned_by_holder_at is None:
        item.custody_marked_returned_by_holder_at = timezone.now()
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_complete_custody_return(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.owner_user_id != user.id:
        return Response({"detail": "Only the owner can confirm a custody return."}, status=403)
    if _active_loan_for_item(item):
        return Response(
            {"detail": "This item has an active loan. Use the loan return flow instead."},
            status=400,
        )
    if not item.custody_marked_returned_by_holder_at:
        return Response({"detail": "The holder has not marked this item as returned yet."}, status=400)
    if item.current_holder_user_id == item.owner_user_id:
        item.custody_marked_returned_by_holder_at = None
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
        return Response(ItemSerializer(item, context={"request": request}).data)
    item.current_holder_user = item.owner_user
    item.custody_disputed = False
    item.custody_marked_returned_by_holder_at = None
    item.custody_pending_acceptance_user = None
    item.save(
        update_fields=[
            "current_holder_user",
            "custody_disputed",
            "custody_marked_returned_by_holder_at",
            "custody_pending_acceptance_user",
            "updated_at",
        ]
    )
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def uploads_presign(request):
    """Presign R2 PUT. Never raises: unexpected errors return JSON 502 with logged traceback."""
    try:
        return _uploads_presign_response(request)
    except Exception as exc:
        logger.exception("closet uploads_presign: unexpected error")
        detail = (
            str(exc)
            if settings.DEBUG
            else "Upload URL could not be created. Check server logs and CLOSET_R2_* / CLOUDFLARE_ACCOUNT_ID."
        )
        return Response({"detail": detail}, status=502)


def _uploads_presign_response(request):
    key_prefix = getattr(settings, "CLOSET_R2_KEY_PREFIX", "closet")
    max_bytes = _env_int("CLOSET_IMAGE_MAX_BYTES", 1048576)
    expires_seconds = min(_env_int("CLOSET_UPLOAD_EXPIRES_SECONDS", 900), 604800)
    mime = request.data.get("content_type", "image/jpeg")
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        return Response({"detail": "Unsupported image mime type."}, status=400)

    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    endpoint_override = getattr(settings, "CLOSET_R2_S3_ENDPOINT_URL", "") or ""
    bucket = os.getenv("CLOSET_R2_BUCKET", "").strip()
    access_key = os.getenv("CLOSET_R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("CLOSET_R2_SECRET_ACCESS_KEY", "").strip()
    has_endpoint = bool(endpoint_override) or bool(account_id)
    if not all([has_endpoint, bucket, access_key, secret_key]):
        return Response(
            {
                "detail": "R2 is not configured.",
                "required_env": [
                    "CLOSET_R2_BUCKET",
                    "CLOSET_R2_ACCESS_KEY_ID",
                    "CLOSET_R2_SECRET_ACCESS_KEY",
                    "CLOUDFLARE_ACCOUNT_ID (or set CLOSET_R2_S3_ENDPOINT_URL to the full S3 API URL from R2)",
                ],
            },
            status=501,
        )
    try:
        import boto3
    except ImportError:
        return Response(
            {
                "detail": (
                    "boto3 is not installed in the Python environment running Django. "
                    "Fix: activate the same venv you use for runserver, then run "
                    "`pip install -r backend/requirements.txt` (or `pip install boto3`)."
                ),
            },
            status=503,
        )
    except Exception as exc:
        logger.exception("boto3 import failed")
        return Response(
            {
                "detail": (
                    f"boto3 import error: {exc!s}. "
                    "Try reinstalling: pip install -U boto3 botocore"
                    if settings.DEBUG
                    else "boto3 failed to load. Check server logs and reinstall dependencies."
                ),
            },
            status=503,
        )

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]
    key = f"{key_prefix}/{request.user.id}/{timezone.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
    if endpoint_override:
        endpoint_url = endpoint_override if "://" in endpoint_override else f"https://{endpoint_override}"
    else:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

    # Match Cloudflare R2 docs (minimal client). Optional path-style SigV4 for SDKs that need it.
    extra_kwargs = {}
    if os.getenv("CLOSET_R2_S3_PATH_STYLE", "0").lower() in ("1", "true", "yes"):
        from botocore.client import Config

        extra_kwargs["config"] = Config(signature_version="s3v4", s3={"addressing_style": "path"})

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        **extra_kwargs,
    )
    presigned_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": mime,
        },
        ExpiresIn=expires_seconds,
    )

    return Response(
        {
            "key": key,
            "upload_url": presigned_url,
            "expires_in_seconds": expires_seconds,
            "max_bytes": max_bytes,
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
        }
    )

