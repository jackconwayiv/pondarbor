"""Shared friend mutations for REST API and Slack interactions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404

from friends.models import FriendRequest
from friends.services import accept_friend_pair

User = get_user_model()


class FriendActionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _pending_incoming_request(*, requested: User, requester_id: int) -> FriendRequest:
    row = (
        FriendRequest.objects.filter(
            requester_id=requester_id,
            requested=requested,
            is_accepted=False,
        )
        .select_related("requester")
        .first()
    )
    if row is None:
        raise FriendActionError("No pending friend request from that user.")
    return row


def accept_incoming_friend_request(*, user: User, requester_id: int) -> None:
    if requester_id == user.id:
        raise FriendActionError("Invalid friend target.")
    other = get_object_or_404(User.objects.all(), pk=requester_id)
    _pending_incoming_request(requested=user, requester_id=requester_id)
    accept_friend_pair(user_a=user, user_b=other)


def decline_incoming_friend_request(*, user: User, requester_id: int) -> None:
    if requester_id == user.id:
        raise FriendActionError("Invalid friend target.")
    other = get_object_or_404(User.objects.all(), pk=requester_id)
    _pending_incoming_request(requested=user, requester_id=requester_id)
    FriendRequest.objects.filter(
        Q(requester=user, requested=other) | Q(requester=other, requested=user)
    ).delete()
