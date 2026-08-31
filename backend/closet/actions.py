"""Shared Closet mutations for REST API and Slack interactions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone

from achievements.services import evaluate_closet_return_achievements_for_users
from closet.models import BorrowRequest, ClosetChannelAsk, Item, Loan
from friends.services import are_friends
from slack_integration.dm_queue import (
    EVENT_CLOSET_BORROW_REQUEST,
    EVENT_CLOSET_CUSTODY_OFFER,
    cancel_slack_dm_queue_items,
    ref_borrow_request,
    ref_item,
)

User = get_user_model()


class ClosetActionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _visible_borrow_requests():
    return BorrowRequest.objects.filter(deleted_at__isnull=True)


def _visible_loans():
    return Loan.objects.filter(deleted_at__isnull=True)


def _item_queryset():
    from closet.services import owner_eligible_for_closet_publication_q

    return (
        Item.objects.filter(deleted_at__isnull=True)
        .filter(owner_eligible_for_closet_publication_q())
        .select_related(
            "owner_user__profile",
            "current_holder_user__profile",
            "custody_pending_acceptance_user__profile",
        )
    )


def _active_loan_for_item(item: Item):
    return (
        item.loans.filter(status=Loan.Status.ACTIVE, deleted_at__isnull=True)
        .select_related("owner_user", "borrower_user")
        .first()
    )


def item_is_loaned(item: Item) -> bool:
    if item.current_holder_user_id != item.owner_user_id:
        return True
    return _active_loan_for_item(item) is not None


def create_closet_item(
    *,
    user: User,
    name: str,
    description: str = "",
    category: str = "",
    tags: list | None = None,
) -> Item:
    trimmed = (name or "").strip()
    if not trimmed:
        raise ClosetActionError("Name is required.")
    item = Item.objects.create(
        owner_user=user,
        current_holder_user=user,
        name=trimmed[:255],
        description=description or "",
        category=category or "",
        tags=list(tags) if tags else [],
        custody_disputed=False,
    )
    from achievements.services import evaluate_closet_sharing_is_caring_for_user

    evaluate_closet_sharing_is_caring_for_user(user.id)
    return item


def create_borrow_request(
    *,
    user: User,
    item: Item,
    date_needed_by,
    message: str = "",
) -> tuple[BorrowRequest, bool]:
    """Create or update a pending borrow request. Returns (row, was_update)."""
    if date_needed_by < timezone.localdate():
        raise ClosetActionError("Need-by date cannot be in the past.")
    if item.deleted_at is not None:
        raise ClosetActionError("Item is not available.")
    if item.owner_user_id == user.id:
        raise ClosetActionError("Owners cannot borrow their own items.")
    if item.current_holder_user_id == user.id:
        raise ClosetActionError("You are already borrowing this item.")
    if not are_friends(user_a=user, user_b=item.owner_user):
        raise ClosetActionError("You can only request items from friends.")
    existing = (
        BorrowRequest.objects.filter(
            item=item,
            requester_user=user,
            status=BorrowRequest.Status.PENDING,
            deleted_at__isnull=True,
        )
        .order_by("date_needed_by", "-created_at")
        .first()
    )
    msg = (message or "").strip()
    if existing:
        existing.date_needed_by = date_needed_by
        existing.message = msg
        existing.save(update_fields=["date_needed_by", "message", "updated_at"])
        return existing, True
    row = BorrowRequest.objects.create(
        item=item,
        requester_user=user,
        status=BorrowRequest.Status.PENDING,
        date_needed_by=date_needed_by,
        message=msg,
    )
    return row, False


def offer_loan_from_ask(*, owner: User, ask: ClosetChannelAsk, item: Item) -> tuple[BorrowRequest, Loan | None]:
    """Create a request as the original asker and auto-approve unless the item is already on loan."""
    if item.owner_user_id != owner.id:
        raise ClosetActionError("Only the owner can offer this item.", status_code=403)
    if ask.requester_user_id == owner.id:
        raise ClosetActionError("You cannot loan this to yourself.")
    if not are_friends(user_a=owner, user_b=ask.requester_user):
        raise ClosetActionError(
            "You're not friends with this person on PondArbor yet. "
            "Send a friend request, then offer the loan from Closet."
        )
    message_parts = [f"From Slack: {ask.raw_text.strip()}"]
    if ask.quantity:
        message_parts.append(f"Requested quantity: {ask.quantity}")
    row, _ = create_borrow_request(
        user=ask.requester_user,
        item=item,
        date_needed_by=ask.date_needed_by,
        message="\n".join(message_parts),
    )
    if _active_loan_for_item(item):
        return row, None
    loan = approve_borrow_request(user=owner, borrow_request_id=row.id)
    return row, loan


def approve_borrow_request(*, user: User, borrow_request_id: int) -> Loan:
    row = get_object_or_404(
        _visible_borrow_requests().select_related("item", "requester_user", "item__owner_user"),
        id=borrow_request_id,
    )
    if row.item.owner_user_id != user.id:
        raise ClosetActionError("Only owner can approve requests.", status_code=403)
    if row.status != BorrowRequest.Status.PENDING:
        raise ClosetActionError("Request is no longer pending.")
    if _active_loan_for_item(row.item):
        raise ClosetActionError("Item already has an active loan.")

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
    cancel_slack_dm_queue_items(
        user_id=user.id,
        event_type=EVENT_CLOSET_BORROW_REQUEST,
        ref_key=ref_borrow_request(borrow_request_id),
    )
    return loan


def decline_borrow_request(*, user: User, borrow_request_id: int, decline_message: str = "") -> BorrowRequest:
    row = get_object_or_404(_visible_borrow_requests().select_related("item"), id=borrow_request_id)
    if row.item.owner_user_id != user.id:
        raise ClosetActionError("Only owner can decline requests.", status_code=403)
    if row.status != BorrowRequest.Status.PENDING:
        raise ClosetActionError("Request is no longer pending.")
    row.status = BorrowRequest.Status.DECLINED
    row.decline_message = (decline_message or "").strip()
    row.responded_at = timezone.now()
    row.save(update_fields=["status", "decline_message", "responded_at", "updated_at"])
    cancel_slack_dm_queue_items(
        user_id=user.id,
        event_type=EVENT_CLOSET_BORROW_REQUEST,
        ref_key=ref_borrow_request(borrow_request_id),
    )
    return row


def accept_custody(*, user: User, item_id: int) -> Item:
    item = get_object_or_404(_item_queryset(), id=item_id)
    if item.custody_pending_acceptance_user_id != user.id:
        raise ClosetActionError("You do not have a pending custody offer for this item.", status_code=403)
    if not are_friends(user_a=user, user_b=item.owner_user):
        raise ClosetActionError("You can only accept custody from friends.")
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
    cancel_slack_dm_queue_items(
        user_id=user.id,
        event_type=EVENT_CLOSET_CUSTODY_OFFER,
        ref_key=ref_item(item_id),
    )
    return item


def reject_pending_custody(*, user: User, item_id: int) -> Item:
    item = get_object_or_404(_item_queryset(), id=item_id)
    if item.custody_pending_acceptance_user_id != user.id:
        raise ClosetActionError("You do not have a pending custody offer for this item.", status_code=403)
    item.custody_pending_acceptance_user = None
    item.save(update_fields=["custody_pending_acceptance_user", "updated_at"])
    cancel_slack_dm_queue_items(
        user_id=user.id,
        event_type=EVENT_CLOSET_CUSTODY_OFFER,
        ref_key=ref_item(item_id),
    )
    return item


def mark_loan_returned_by_borrower(*, user: User, loan_id: int) -> tuple[Loan, bool]:
    """Returns (loan, first_mark) — first_mark is True when timestamp was newly set."""
    loan = get_object_or_404(
        _visible_loans().select_related("item", "borrower_user", "owner_user"),
        id=loan_id,
    )
    if loan.borrower_user_id != user.id:
        raise ClosetActionError("Only borrower can mark returned-by-borrower.", status_code=403)
    if loan.status != Loan.Status.ACTIVE:
        raise ClosetActionError("Only active loans can be marked.")
    first_mark = loan.marked_returned_by_borrower_at is None
    if first_mark:
        loan.marked_returned_by_borrower_at = timezone.now()
        loan.save(update_fields=["marked_returned_by_borrower_at"])
    return loan, first_mark


def mark_custody_returned_by_holder(*, user: User, item_id: int) -> tuple[Item, bool]:
    item = get_object_or_404(_item_queryset(), id=item_id)
    if item.current_holder_user_id != user.id:
        raise ClosetActionError("Only the current holder can mark a custody return.", status_code=403)
    if item.owner_user_id == user.id:
        raise ClosetActionError("You already have custody as the owner.")
    if _active_loan_for_item(item):
        raise ClosetActionError("This item has an active loan. Use the loan return flow instead.")
    if not are_friends(user_a=user, user_b=item.owner_user):
        raise ClosetActionError("You can only update items from friends.")
    first_mark = item.custody_marked_returned_by_holder_at is None
    if first_mark:
        item.custody_marked_returned_by_holder_at = timezone.now()
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
    return item, first_mark


def confirm_loan_return(*, user: User, loan_id: int) -> Loan:
    loan = get_object_or_404(
        _visible_loans().select_related("item", "owner_user", "borrower_user"),
        id=loan_id,
    )
    if loan.owner_user_id != user.id:
        raise ClosetActionError("Only owner can mark returned.", status_code=403)
    if loan.status != Loan.Status.ACTIVE:
        raise ClosetActionError("Loan is not active.")

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
    evaluate_closet_return_achievements_for_users(
        owner_user_id=loan.owner_user_id,
        borrower_user_id=loan.borrower_user_id,
    )
    return loan


def confirm_custody_return(*, user: User, item_id: int) -> tuple[Item, User | None]:
    """Returns (item, former_holder) for notifications."""
    item = get_object_or_404(_item_queryset(), id=item_id)
    if item.owner_user_id != user.id:
        raise ClosetActionError("Only the owner can confirm a custody return.", status_code=403)
    if _active_loan_for_item(item):
        raise ClosetActionError("This item has an active loan. Use the loan return flow instead.")
    if not item.custody_marked_returned_by_holder_at:
        raise ClosetActionError("The holder has not marked this item as returned yet.")
    former_holder = item.current_holder_user
    if item.current_holder_user_id == item.owner_user_id:
        item.custody_marked_returned_by_holder_at = None
        item.save(update_fields=["custody_marked_returned_by_holder_at", "updated_at"])
        return item, None
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
    return item, former_holder
