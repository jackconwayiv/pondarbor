"""Closet domain helpers: owner visibility and soft-removal when a user is disabled."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from closet.models import BorrowRequest, Item, Loan

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
