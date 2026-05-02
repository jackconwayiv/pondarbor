"""Closet domain helpers: owner visibility and soft-removal when a user is disabled."""

from __future__ import annotations

from typing import Iterable

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from closet.models import BorrowRequest, Item, ItemHidden, Loan

User = get_user_model()


def owner_eligible_for_closet_publication_q() -> Q:
    """Items with this owner are shown in API lists (friends browse, holders, etc.)."""
    return Q(
        owner_user__account_status=User.AccountStatus.APPROVED,
        owner_user__deleted_at__isnull=True,
    )


def item_fk_owner_publication_eligible_q() -> Q:
    """For querysets that join Item via ``item`` (e.g. BorrowRequest)."""
    return Q(
        item__owner_user__account_status=User.AccountStatus.APPROVED,
        item__owner_user__deleted_at__isnull=True,
    )


def user_must_hide_owned_closet_data(user) -> bool:
    return bool(user.deleted_at) or user.account_status != User.AccountStatus.APPROVED


def can_hide_item_for_user(item: Item, user) -> bool:
    """True iff ``user`` can mark ``item`` as hidden in their browse grid.

    Hiding is only allowed for items with no active relationship to the user:
    not the owner, not the current holder/borrower, not the pending custody
    recipient, and no pending or declined borrow request for this item.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if item.owner_user_id == user.id:
        return False
    if item.current_holder_user_id == user.id:
        return False
    if item.custody_pending_acceptance_user_id == user.id:
        return False
    if BorrowRequest.objects.filter(
        item=item,
        requester_user=user,
        status__in=(BorrowRequest.Status.PENDING, BorrowRequest.Status.DECLINED),
        deleted_at__isnull=True,
    ).exists():
        return False
    return True


def hidden_item_ids_for_user(user, item_ids: Iterable[int]) -> set[int]:
    """Set of ``item_id`` values that ``user`` has hidden, restricted to ``item_ids``."""
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    ids = [pk for pk in item_ids if pk is not None]
    if not ids:
        return set()
    return set(
        ItemHidden.objects.filter(user=user, item_id__in=ids).values_list("item_id", flat=True)
    )


def soft_hide_owned_closet_data_for_user(user) -> None:
    """
    Soft-delete all items owned by this user and soft-delete borrow requests and loans
    tied to those items. Idempotent.
    """
    if not user_must_hide_owned_closet_data(user):
        return
    now = timezone.now()
    item_ids = list(
        Item.objects.filter(owner_user=user, deleted_at__isnull=True).values_list("id", flat=True)
    )
    if not item_ids:
        return
    Item.objects.filter(id__in=item_ids).update(deleted_at=now)
    BorrowRequest.objects.filter(item_id__in=item_ids, deleted_at__isnull=True).update(
        deleted_at=now
    )
    Loan.objects.filter(item_id__in=item_ids, deleted_at__isnull=True).update(deleted_at=now)
