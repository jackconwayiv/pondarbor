import json
import logging
import os
import uuid
from collections import defaultdict
from contextlib import contextmanager
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import cache_control
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.status import HTTP_201_CREATED, HTTP_204_NO_CONTENT

from closet.constants import CANONICAL_CLOSET_CATEGORIES, FRIENDS_ITEMS_CATEGORY_OTHER
from closet.models import BorrowRequest, Item, ItemHidden, Loan
from closet.serializers import (
    BorrowRequestCreateSerializer,
    BorrowRequestSerializer,
    ItemCreateSerializer,
    ItemPatchSerializer,
    ItemSerializer,
    LoanSerializer,
    closet_image_key_owned_by_user,
    closet_item_image_url,
    expected_closet_image_key_prefix,
)
from closet.services import (
    can_hide_item_for_user,
    hidden_item_ids_for_user,
    item_fk_owner_publication_eligible_q,
    owner_eligible_for_closet_publication_q,
)
from friends.services import are_friends, friend_ids_for_user
from achievements.services import evaluate_closet_sharing_is_caring_for_user
from closet.actions import (
    ClosetActionError,
    accept_custody,
    approve_borrow_request,
    confirm_custody_return,
    confirm_loan_return,
    decline_borrow_request,
    mark_custody_returned_by_holder,
    mark_loan_returned_by_borrower,
    reject_pending_custody,
)
from closet.slack_hooks import schedule_closet_slack_notify
from closet.slack_notify import (
    notify_borrow_request_approved_to_requester,
    notify_borrow_request_canceled_to_owner,
    notify_borrow_request_declined_to_requester,
    notify_borrow_request_to_owner,
    notify_custody_dispute_to_owner,
    notify_custody_marked_returned_to_owner,
    notify_custody_offer_canceled_to_holder,
    notify_custody_offer_rejected_to_owner,
    notify_custody_offer_to_holder,
    notify_custody_return_completed_to_holder,
    notify_loan_marked_returned_to_owner,
    notify_loan_return_completed_to_borrower,
)
from common.r2_s3 import (
    build_r2_s3_client,
    r2_bucket_config_from_env,
    r2_presigned_get_url,
    r2_read_expires_seconds,
)
from meal.r2_storage import expected_meal_image_key_prefix, meal_image_key_owned_by_user
from users.permissions import IsApprovedUser
from users.models import Profile
from users.social_privacy import viewer_context

User = get_user_model()

logger = logging.getLogger(__name__)
@contextmanager
def _endpoint_metrics(name: str):
    start_queries = len(getattr(connection, "queries", [])) if settings.DEBUG else 0
    started = timezone.now()
    try:
        yield
    finally:
        elapsed_ms = int((timezone.now() - started).total_seconds() * 1000)
        if settings.DEBUG:
            query_count = len(getattr(connection, "queries", [])) - start_queries
            logger.info("closet.%s duration_ms=%s query_count=%s", name, elapsed_ms, query_count)
        else:
            logger.info("closet.%s duration_ms=%s", name, elapsed_ms)



def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid integer for %s=%r; using default %s", name, raw, default)
        return default


def _r2_client_config_or_response():
    config = r2_bucket_config_from_env()
    if config is None:
        return (
            None,
            Response(
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
            ),
        )
    return (config, None)


def _build_r2_client(config: dict):
    try:
        return build_r2_s3_client(config)
    except RuntimeError as exc:
        raise RuntimeError(
            str(exc)
            + " Fix: activate the same venv you use for runserver, then "
            "`pip install -r backend/requirements.txt` (or `pip install boto3`).",
        ) from exc


def _user_owns_storage_image_key(key: str, user_id: int) -> bool:
    return closet_image_key_owned_by_user(key, user_id) or meal_image_key_owned_by_user(
        key,
        user_id,
    )


def _list_user_bucket_keys(*, client, bucket: str, key_prefix: str) -> set[str]:
    rows: set[str] = set()
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": key_prefix}
        if token:
            kwargs["ContinuationToken"] = token
        payload = client.list_objects_v2(**kwargs)
        for obj in payload.get("Contents", []) or []:
            key = (obj.get("Key") or "").strip()
            if key and key.startswith(key_prefix):
                rows.add(key)
        if not payload.get("IsTruncated"):
            break
        token = payload.get("NextContinuationToken")
    return rows


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


def _item_serializer_context(request, items):
    """Build a serializer context that batches the per-viewer hidden lookup.

    Pass ``items`` as a list/iterable of Item or item ids (or any mix). For
    single-item serialization just pass ``[item]``.
    """
    user = getattr(request, "user", None)
    ids: list[int] = []
    for item in items or []:
        if isinstance(item, Item):
            ids.append(item.id)
        elif isinstance(item, int):
            ids.append(item)
    hidden_ids = hidden_item_ids_for_user(user, ids)
    ctx = {"request": request, "viewer_hidden_item_ids": hidden_ids}
    if not ids:
        return ctx
    pending_counts = dict(
        BorrowRequest.objects.filter(
            item_id__in=ids,
            status=BorrowRequest.Status.PENDING,
            deleted_at__isnull=True,
        )
        .values("item_id")
        .annotate(c=Count("id"))
        .values_list("item_id", "c")
    )
    active_loans = list(
        Loan.objects.filter(
            item_id__in=ids,
            status=Loan.Status.ACTIVE,
            deleted_at__isnull=True,
        ).values("item_id", "id", "marked_returned_by_borrower_at")
    )
    ctx["pending_request_count_by_item_id"] = pending_counts
    ctx["active_loan_id_by_item_id"] = {int(r["item_id"]): int(r["id"]) for r in active_loans}
    ctx["active_loan_marked_returned_by_borrower_by_item_id"] = {
        int(r["item_id"]): bool(r["marked_returned_by_borrower_at"]) for r in active_loans
    }
    if user and getattr(user, "is_authenticated", False):
        my_pending_rows = (
            BorrowRequest.objects.filter(
                item_id__in=ids,
                requester_user=user,
                status=BorrowRequest.Status.PENDING,
                deleted_at__isnull=True,
            )
            .order_by("item_id", "date_needed_by", "-created_at")
            .select_related("requester_user__profile")
        )
        my_declined_rows = (
            BorrowRequest.objects.filter(
                item_id__in=ids,
                requester_user=user,
                status=BorrowRequest.Status.DECLINED,
                deleted_at__isnull=True,
            )
            .order_by("item_id", "-responded_at", "-updated_at", "-created_at")
            .select_related("requester_user__profile")
        )
        pending_by_item = {}
        for row in my_pending_rows:
            pending_by_item.setdefault(row.item_id, row)
        declined_by_item = {}
        for row in my_declined_rows:
            declined_by_item.setdefault(row.item_id, row)
        ctx["my_pending_request_by_item_id"] = pending_by_item
        ctx["my_declined_request_by_item_id"] = declined_by_item
    return ctx


def _parse_include_set(request):
    raw = (request.query_params.get("include") or "").strip()
    if not raw:
        return None
    return {part.strip() for part in raw.split(",") if part.strip()}


def _prefetch_pending_borrow_requests(items: list[Item]) -> None:
    """Attach _prefetched_pending_borrow_requests on each Item for ItemSerializer (owner-only field)."""
    if not items:
        return
    by_item: dict[int, list[BorrowRequest]] = {i.id: [] for i in items}
    rows = (
        BorrowRequest.objects.filter(
            item_id__in=by_item.keys(),
            status=BorrowRequest.Status.PENDING,
            deleted_at__isnull=True,
        )
        .select_related("requester_user__profile")
        .order_by("date_needed_by", "-created_at")
    )
    for r in rows:
        by_item[r.item_id].append(r)
    for item in items:
        item._prefetched_pending_borrow_requests = by_item[item.id]


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
    """DB-native tag substring filter over JSON text payload."""
    return qs.filter(tags__icontains=tag_needle.strip())


def _friends_items_filter_by_preset_category(qs, category: str):
    """
    Preset/custom category string: match trimmed category field (case-insensitive) OR any tag
    that equals the same string (case-insensitive). Covers items where the preset was stored as a tag.
    """
    needle = category.strip().casefold()
    if not needle:
        return qs
    # Tags fallback keeps compatibility with older rows that stored preset category in tags.
    return qs.filter(Q(category__iexact=category.strip()) | Q(tags__icontains=needle))


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "closet", "ok": True})


def _closet_action_summary_payload(user):
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
    return {"outstanding_actions_count": total}


def _items_mine_payload(request):
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
    borrowed_list = list(borrowed_by_me_qs)
    custody_offered_list = list(custody_offered_qs)
    owned_list = list(owned_qs)
    all_items = declined_items + borrowed_list + custody_offered_list + requested_items + owned_list
    _prefetch_pending_borrow_requests(all_items)
    ctx = _item_serializer_context(request, all_items)
    include = _parse_include_set(request)
    payload = {
        "declined_by_me": ItemSerializer(declined_items, many=True, context=ctx).data,
        "borrowed_by_me": ItemSerializer(borrowed_list, many=True, context=ctx).data,
        "custody_offered_to_me": ItemSerializer(custody_offered_list, many=True, context=ctx).data,
        "requested_by_me": ItemSerializer(requested_items, many=True, context=ctx).data,
        "owned_by_me": ItemSerializer(owned_list, many=True, context=ctx).data,
    }
    if include is not None:
        payload = {k: v for k, v in payload.items() if k in include}
    return payload


def _items_friends_payload(request):
    user = request.user
    ctx = viewer_context(viewer=user)
    friend_ids = ctx.friend_ids
    include_self = (request.query_params.get("include_self") or "").strip().lower() == "true"

    scope = getattr(getattr(user, "profile", None), "social_read_scope", None) or Profile.SocialReadScope.APPROVED_USERS
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        owner_ids = list(friend_ids)
        if include_self:
            owner_ids = list({*owner_ids, user.id})
        qs = _item_queryset().filter(owner_user_id__in=owner_ids)
        if not include_self:
            qs = qs.exclude(owner_user=user)
    else:
        qs = _item_queryset()
        if not include_self:
            qs = qs.exclude(owner_user=user)

    visibility_q = (
        Q(owner_user__profile__social_publish_visibility=Profile.SocialPublishVisibility.ALL_APPROVED)
        | Q(owner_user__profile__isnull=True)
        | (
            Q(owner_user_id__in=list(friend_ids))
            & Q(owner_user__profile__social_publish_visibility=Profile.SocialPublishVisibility.FRIENDS_ONLY)
        )
    )
    if include_self:
        visibility_q = visibility_q | Q(owner_user_id=user.id)
    qs = qs.filter(visibility_q)

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

    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))

    sort_key = (request.query_params.get("sort") or "updated_desc").strip()
    order = FRIENDS_ITEMS_SORT_FIELDS.get(sort_key, FRIENDS_ITEMS_SORT_FIELDS["updated_desc"])
    qs = qs.order_by(*order)

    page = max(1, int(request.query_params.get("page", "1")))
    page_size = min(50, max(1, int(request.query_params.get("page_size", "10"))))
    start = (page - 1) * page_size
    end = start + page_size
    total = qs.count()
    rows = list(qs[start:end])
    _prefetch_pending_borrow_requests(rows)
    return {
        "results": ItemSerializer(rows, many=True, context=_item_serializer_context(request, rows)).data,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_next": end < total,
        "has_prev": page > 1,
    }


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def closet_action_summary(request):
    return Response(_closet_action_summary_payload(request.user))


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def items_mine(request):
    with _endpoint_metrics("items_mine"):
        if request.method == "POST":
            serializer = ItemCreateSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            item = serializer.save()
            evaluate_closet_sharing_is_caring_for_user(item.owner_user_id)
            return Response(
                ItemSerializer(item, context=_item_serializer_context(request, [item])).data,
                status=HTTP_201_CREATED,
            )

        return Response(_items_mine_payload(request))


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def items_friends(request):
    with _endpoint_metrics("items_friends"):
        return Response(_items_friends_payload(request))


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def closet_bootstrap(request):
    """Initial Closet payload for first render: mine + current grid + action summary."""
    with _endpoint_metrics("closet_bootstrap"):
        return Response(
            {
                "my_items": _items_mine_payload(request),
                "friends_grid": _items_friends_payload(request),
                "action_summary": _closet_action_summary_payload(request.user),
            }
        )


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def items_friend_owner(request, owner_user_id: int):
    user = request.user
    if user.id == owner_user_id:
        return Response({"detail": "Use /api/v1/closet/items/ for your own closet."}, status=400)
    owner = User.objects.filter(pk=owner_user_id).first()
    if owner is None:
        return Response({"detail": "Not found."}, status=404)
    if not are_friends(user_a=user, user_b=owner):
        return Response(
            {"detail": "You can only browse closet items owned by approved friends."},
            status=status.HTTP_403_FORBIDDEN,
        )
    rows = list(
        _item_queryset()
        .filter(owner_user_id=owner_user_id)
        .exclude(owner_user_id=user.id)
        .order_by("-updated_at", "-id")
    )
    return Response(
        ItemSerializer(rows, many=True, context=_item_serializer_context(request, rows)).data
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
        return Response(
            ItemSerializer(item, context=_item_serializer_context(request, [item])).data
        )

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
        return Response(
            ItemSerializer(item, context=_item_serializer_context(request, [item])).data
        )

    item.deleted_at = timezone.now()
    item.save(update_fields=["deleted_at", "updated_at"])
    evaluate_closet_sharing_is_caring_for_user(item.owner_user_id)
    return Response(status=HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def item_hide(request, item_id: int):
    user = request.user
    qs = _item_queryset().filter(
        Q(owner_user=user)
        | Q(current_holder_user=user)
        | Q(custody_pending_acceptance_user=user)
        | Q(owner_user_id__in=friend_ids_for_user(user=user))
    )
    item = get_object_or_404(qs, id=item_id)
    if not can_hide_item_for_user(item, user):
        return Response(
            {"detail": "This item cannot be hidden because you have an active relationship with it."},
            status=400,
        )
    ItemHidden.objects.get_or_create(user=user, item=item)
    return Response(
        ItemSerializer(item, context=_item_serializer_context(request, [item])).data
    )


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def item_unhide(request, item_id: int):
    user = request.user
    qs = _item_queryset().filter(
        Q(owner_user=user)
        | Q(current_holder_user=user)
        | Q(custody_pending_acceptance_user=user)
        | Q(owner_user_id__in=friend_ids_for_user(user=user))
    )
    item = get_object_or_404(qs, id=item_id)
    ItemHidden.objects.filter(user=user, item=item).delete()
    return Response(
        ItemSerializer(item, context=_item_serializer_context(request, [item])).data
    )


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def borrow_request_create(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    was_pending = _visible_borrow_requests().filter(
        item=item,
        requester_user=request.user,
        status=BorrowRequest.Status.PENDING,
    ).exists()
    serializer = BorrowRequestCreateSerializer(
        data=request.data,
        context={"request": request, "item": item},
    )
    serializer.is_valid(raise_exception=True)
    row = serializer.save()
    schedule_closet_slack_notify(
        notify_borrow_request_to_owner,
        row=row,
        is_update=was_pending,
    )
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
    try:
        loan = approve_borrow_request(user=request.user, borrow_request_id=borrow_request_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    schedule_closet_slack_notify(notify_borrow_request_approved_to_requester, loan=loan)
    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def borrow_request_decline(request, borrow_request_id: int):
    decline_message = request.data.get("decline_message", "")
    if decline_message is None:
        decline_message = ""
    try:
        row = decline_borrow_request(
            user=request.user,
            borrow_request_id=borrow_request_id,
            decline_message=str(decline_message),
        )
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    schedule_closet_slack_notify(notify_borrow_request_declined_to_requester, row=row)
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
    from slack_integration.dm_queue import EVENT_CLOSET_BORROW_REQUEST, cancel_slack_dm_queue_items, ref_borrow_request

    cancel_slack_dm_queue_items(
        user_id=row.item.owner_user_id,
        event_type=EVENT_CLOSET_BORROW_REQUEST,
        ref_key=ref_borrow_request(borrow_request_id),
    )
    schedule_closet_slack_notify(notify_borrow_request_canceled_to_owner, row=row)
    return Response(BorrowRequestSerializer(row).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def loan_mark_returned_by_borrower(request, loan_id: int):
    try:
        loan, first_mark = mark_loan_returned_by_borrower(user=request.user, loan_id=loan_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    if first_mark:
        schedule_closet_slack_notify(notify_loan_marked_returned_to_owner, loan=loan)
    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def loan_mark_returned(request, loan_id: int):
    try:
        loan = confirm_loan_return(user=request.user, loan_id=loan_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    schedule_closet_slack_notify(notify_loan_return_completed_to_borrower, loan=loan)
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
        schedule_closet_slack_notify(notify_custody_offer_to_holder, item=item, holder=holder)
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
    schedule_closet_slack_notify(notify_custody_dispute_to_owner, item=item)
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_accept_custody(request, item_id: int):
    try:
        item = accept_custody(user=request.user, item_id=item_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_reject_pending_custody(request, item_id: int):
    item = get_object_or_404(_item_queryset(), id=item_id)
    user = request.user
    if item.custody_pending_acceptance_user_id != user.id:
        return Response({"detail": "You do not have a pending custody offer for this item."}, status=403)
    holder = item.custody_pending_acceptance_user
    try:
        item = reject_pending_custody(user=user, item_id=item_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    schedule_closet_slack_notify(
        notify_custody_offer_rejected_to_owner,
        item=item,
        holder=holder,
    )
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
    holder = item.custody_pending_acceptance_user
    item.custody_pending_acceptance_user = None
    item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
    from slack_integration.dm_queue import EVENT_CLOSET_CUSTODY_OFFER, cancel_slack_dm_queue_items, ref_item

    cancel_slack_dm_queue_items(
        user_id=holder.id,
        event_type=EVENT_CLOSET_CUSTODY_OFFER,
        ref_key=ref_item(item_id),
    )
    schedule_closet_slack_notify(
        notify_custody_offer_canceled_to_holder,
        item=item,
        holder=holder,
    )
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_mark_custody_returned_by_holder(request, item_id: int):
    try:
        item, first_mark = mark_custody_returned_by_holder(user=request.user, item_id=item_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    if first_mark:
        schedule_closet_slack_notify(notify_custody_marked_returned_to_owner, item=item)
    return Response(ItemSerializer(item, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def item_complete_custody_return(request, item_id: int):
    try:
        item, former_holder = confirm_custody_return(user=request.user, item_id=item_id)
    except ClosetActionError as exc:
        return Response({"detail": exc.message}, status=exc.status_code)
    if former_holder is not None:
        schedule_closet_slack_notify(
            notify_custody_return_completed_to_holder,
            item=item,
            holder=former_holder,
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


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@cache_control(private=True, no_store=True)
def uploads_presign_read(request):
    """Presign R2 GET for an object key owned by the requester."""
    raw_key = str(request.data.get("key") or "").strip()
    if not raw_key:
        return Response({"detail": "key is required."}, status=400)
    uid = request.user.id
    if not (
        closet_image_key_owned_by_user(raw_key, uid)
        or meal_image_key_owned_by_user(raw_key, uid)
    ):
        return Response({"detail": "Image key must belong to your account prefix."}, status=403)

    config, config_error = _r2_client_config_or_response()
    if config_error:
        return config_error
    try:
        client = _build_r2_client(config)
    except Exception as exc:
        logger.exception("uploads_presign_read: boto3 failed")
        detail = str(exc) if settings.DEBUG else "Storage client failed to initialize."
        return Response({"detail": detail}, status=503)

    view_url = r2_presigned_get_url(raw_key, client=client)
    if not view_url:
        return Response({"detail": "Could not create view URL."}, status=502)
    expires = r2_read_expires_seconds()
    return Response({"view_url": view_url, "expires_in_seconds": expires})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
@cache_control(private=True, no_store=True)
def images_mine(request):
    from meal.models import Meal
    from people.models import Person

    closet_key_prefix = expected_closet_image_key_prefix(request.user.id)
    meal_key_prefix = expected_meal_image_key_prefix(request.user.id)
    user_id = request.user.id
    db_qs = Item.objects.filter(
        owner_user=request.user,
        deleted_at__isnull=True,
    ).exclude(image_key="")
    item_names_by_key: dict[str, list[str]] = defaultdict(list)
    item_ids_by_key: dict[str, list[int]] = defaultdict(list)
    for row in db_qs.values("id", "name", "image_key"):
        key = (row.get("image_key") or "").strip()
        if not key or not closet_image_key_owned_by_user(key, user_id):
            continue
        item_ids_by_key[key].append(int(row["id"]))
        item_names_by_key[key].append(str(row.get("name") or "").strip() or f"Item {row['id']}")
    item_db_keys = set(item_ids_by_key.keys())

    meal_ids_by_key: dict[str, list[int]] = defaultdict(list)
    meal_titles_by_key: dict[str, list[str]] = defaultdict(list)
    for row in Meal.objects.filter(owner_user=request.user).exclude(image_key="").values(
        "id",
        "title",
        "image_key",
    ):
        key = (row.get("image_key") or "").strip()
        if not key or not meal_image_key_owned_by_user(key, user_id):
            continue
        meal_ids_by_key[key].append(int(row["id"]))
        meal_titles_by_key[key].append(str(row.get("title") or "").strip() or f"Meal {row['id']}")
    meal_db_keys = set(meal_ids_by_key.keys())

    person_ids_by_key: dict[str, list[str]] = defaultdict(list)
    person_names_by_key: dict[str, list[str]] = defaultdict(list)
    for row in Person.objects.filter(
        owner_user=request.user,
        deleted_at__isnull=True,
    ).exclude(image_key="").values("id", "name", "image_key"):
        key = (row.get("image_key") or "").strip()
        if not key or not closet_image_key_owned_by_user(key, user_id):
            continue
        pid = str(row["id"])
        person_ids_by_key[key].append(pid)
        person_names_by_key[key].append(str(row.get("name") or "").strip() or f"Person {pid}")
    person_db_keys = set(person_ids_by_key.keys())

    profile_avatar_key = (
        Profile.objects.filter(user=request.user)
        .values_list("avatar_image_key", flat=True)
        .first()
        or ""
    ).strip()

    config, config_error = _r2_client_config_or_response()
    if config_error:
        return config_error
    try:
        client = _build_r2_client(config)
        bucket_keys_closet = _list_user_bucket_keys(
            client=client,
            bucket=config["bucket"],
            key_prefix=closet_key_prefix,
        )
        bucket_keys_closet = {
            k for k in bucket_keys_closet if closet_image_key_owned_by_user(k, user_id)
        }

        # Meal images share the same R2 bucket only when configured; otherwise treat as empty.
        bucket_keys_meal = set()
        if meal_key_prefix:
            try:
                bucket_keys_meal = _list_user_bucket_keys(
                    client=client,
                    bucket=config["bucket"],
                    key_prefix=meal_key_prefix,
                )
            except StopIteration:
                # Unit tests may mock list_objects_v2 with a single response for the closet prefix only.
                bucket_keys_meal = set()
            bucket_keys_meal = {
                k for k in bucket_keys_meal if meal_image_key_owned_by_user(k, user_id)
            }
    except Exception as exc:
        logger.exception("closet images_mine: failed to list R2 objects")
        detail = str(exc) if settings.DEBUG else "Failed to list images from storage."
        return Response({"detail": detail}, status=502)

    bucket_keys_union = bucket_keys_closet | bucket_keys_meal
    all_keys = sorted(
        k
        for k in (item_db_keys | meal_db_keys | person_db_keys | bucket_keys_union)
        if _user_owns_storage_image_key(k, user_id)
    )
    rows = []
    for key in all_keys:
        attached_item_ids = sorted(item_ids_by_key.get(key, []))
        attached_item_names = item_names_by_key.get(key, [])
        attached_count = len(attached_item_ids)
        attached_meal_ids = sorted(meal_ids_by_key.get(key, []))
        attached_meal_titles = meal_titles_by_key.get(key, [])
        attached_meal_count = len(attached_meal_ids)
        attached_person_ids = sorted(person_ids_by_key.get(key, []))
        attached_person_names = person_names_by_key.get(key, [])
        attached_person_count = len(attached_person_ids)
        attached_as_avatar = bool(profile_avatar_key and profile_avatar_key == key)
        is_attached = (
            attached_count > 0
            or attached_as_avatar
            or attached_meal_count > 0
            or attached_person_count > 0
        )
        rows.append(
            {
                "image_key": key,
                "image_url": closet_item_image_url(key),
                "attached_live_item_count": attached_count,
                "attached_live_item_ids": attached_item_ids,
                "attached_live_item_names": attached_item_names,
                "attached_meal_count": attached_meal_count,
                "attached_meal_ids": attached_meal_ids,
                "attached_meal_titles": attached_meal_titles,
                "attached_person_count": attached_person_count,
                "attached_person_ids": attached_person_ids,
                "attached_person_names": attached_person_names,
                "attached_as_avatar": attached_as_avatar,
                "status": "attached" if is_attached else "stranded",
                "present_in_bucket": key in bucket_keys_union,
            }
        )
    return Response({"results": rows})


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@cache_control(private=True, no_store=True)
@transaction.atomic
def image_delete(request):
    from meal.models import Meal
    from people.models import Person

    raw_key = str(request.data.get("image_key") or "").strip()
    if not raw_key:
        return Response({"detail": "image_key is required."}, status=400)
    uid = request.user.id
    if not _user_owns_storage_image_key(raw_key, uid):
        return Response({"detail": "Image key must belong to your account prefix."}, status=403)

    config, config_error = _r2_client_config_or_response()
    if config_error:
        return config_error
    detached_count = Item.objects.filter(
        owner_user=request.user,
        deleted_at__isnull=True,
        image_key=raw_key,
    ).update(image_key="")
    detached_avatar_count = Profile.objects.filter(
        user=request.user,
        avatar_image_key=raw_key,
    ).update(avatar_image_key="")
    if detached_avatar_count:
        from users.avatar_url import idp_picture_for_request, restore_idp_avatar_url_if_empty

        profile = Profile.objects.get(user=request.user)
        restore_idp_avatar_url_if_empty(profile, picture=idp_picture_for_request(request))
    detached_meal_count = Meal.objects.filter(owner_user=request.user, image_key=raw_key).update(
        image_key="",
    )
    detached_person_count = Person.objects.filter(
        owner_user=request.user,
        deleted_at__isnull=True,
        image_key=raw_key,
    ).update(image_key="")

    try:
        client = _build_r2_client(config)
        client.delete_object(Bucket=config["bucket"], Key=raw_key)
    except Exception as exc:
        logger.exception("closet image_delete: failed deleting key=%s", raw_key)
        detail = str(exc) if settings.DEBUG else "Failed to delete image from storage."
        return Response({"detail": detail}, status=502)

    return Response(
        {
            "deleted": True,
            "image_key": raw_key,
            "detached_live_item_count": detached_count,
            "detached_avatar_count": detached_avatar_count,
            "detached_meal_count": detached_meal_count,
            "detached_person_count": detached_person_count,
        }
    )


def _uploads_presign_response(request):
    key_prefix = getattr(settings, "CLOSET_R2_KEY_PREFIX", "closet")
    max_bytes = _env_int("CLOSET_IMAGE_MAX_BYTES", 1048576)
    expires_seconds = min(_env_int("CLOSET_UPLOAD_EXPIRES_SECONDS", 900), 604800)
    mime = request.data.get("content_type", "image/jpeg")
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        return Response({"detail": "Unsupported image mime type."}, status=400)

    config, config_error = _r2_client_config_or_response()
    if config_error:
        return config_error

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]
    key = f"{key_prefix}/{request.user.id}/{timezone.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
    try:
        client = _build_r2_client(config)
    except Exception as exc:
        logger.exception("boto3 import failed")
        return Response(
            {
                "detail": (
                    f"boto3 import error: {exc!s}. Try reinstalling: pip install -U boto3 botocore"
                    if settings.DEBUG
                    else "boto3 failed to load. Check server logs and reinstall dependencies."
                ),
            },
            status=503,
        )
    presigned_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": config["bucket"],
            "Key": key,
            "ContentType": mime,
        },
        ExpiresIn=expires_seconds,
    )
    read_expires = r2_read_expires_seconds()
    view_url = client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": config["bucket"], "Key": key},
        ExpiresIn=read_expires,
    )

    return Response(
        {
            "key": key,
            "upload_url": presigned_url,
            "view_url": view_url,
            "expires_in_seconds": expires_seconds,
            "view_expires_in_seconds": read_expires,
            "max_bytes": max_bytes,
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
        }
    )

