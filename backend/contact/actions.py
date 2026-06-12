"""Shared contact inbox mutations for REST API and Slack interactions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone

from contact.models import ContactMessage

User = get_user_model()


class ContactActionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _require_staff_user(user: User) -> None:
    if not getattr(user, "is_staff", False):
        raise ContactActionError("Staff access required.", status_code=403)


def acknowledge_contact_message(*, staff_user: User, message_id: int) -> ContactMessage:
    _require_staff_user(staff_user)
    cm = get_object_or_404(ContactMessage.objects.all(), pk=message_id)
    if cm.read_at is None:
        cm.read_at = timezone.now()
        cm.read_by = staff_user
        cm.save(update_fields=["read_at", "read_by"])
    return cm
