"""Shared staff mutations for REST API and Slack interactions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from slack_integration.dm_queue import EVENT_STAFF_PENDING_MEMBER, cancel_slack_dm_queue_items, ref_user

User = get_user_model()


class StaffActionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _require_staff_user(user: User) -> None:
    if not getattr(user, "is_staff", False):
        raise StaffActionError("Staff access required.", status_code=403)


def approve_pending_member(*, staff_user: User, user_id: int) -> User:
    _require_staff_user(staff_user)
    if user_id == staff_user.id:
        raise StaffActionError("You cannot change your own account status here.", status_code=403)
    target = get_object_or_404(User.objects.all(), pk=user_id)
    if target.account_status != User.AccountStatus.PENDING:
        raise StaffActionError("That member is no longer pending approval.")
    target.account_status = User.AccountStatus.APPROVED
    target.save(update_fields=["account_status"])
    cancel_slack_dm_queue_items(
        event_type=EVENT_STAFF_PENDING_MEMBER,
        ref_key=ref_user(user_id),
    )
    return target


def reject_pending_member(*, staff_user: User, user_id: int) -> User:
    _require_staff_user(staff_user)
    if user_id == staff_user.id:
        raise StaffActionError("You cannot change your own account status here.", status_code=403)
    target = get_object_or_404(User.objects.all(), pk=user_id)
    if target.account_status != User.AccountStatus.PENDING:
        raise StaffActionError("That member is no longer pending approval.")
    target.account_status = User.AccountStatus.REJECTED
    target.save(update_fields=["account_status"])
    cancel_slack_dm_queue_items(
        event_type=EVENT_STAFF_PENDING_MEMBER,
        ref_key=ref_user(user_id),
    )
    return target
