from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from friends.models import FriendRequest

User = get_user_model()


def friends_queryset_for_user(*, user) -> QuerySet:
    return User.objects.filter(
        Q(sent_friend_requests__requested=user, sent_friend_requests__is_accepted=True)
        | Q(received_friend_requests__requester=user, received_friend_requests__is_accepted=True)
    ).exclude(pk=user.pk).distinct()


def are_friends(*, user_a, user_b) -> bool:
    if not user_a or not user_b:
        return False
    if user_a.pk == user_b.pk:
        return True
    return FriendRequest.objects.filter(
        Q(requester=user_a, requested=user_b, is_accepted=True)
        | Q(requester=user_b, requested=user_a, is_accepted=True)
    ).exists()


def friend_ids_for_user(*, user) -> set[int]:
    sent = FriendRequest.objects.filter(requester=user, is_accepted=True).values_list(
        "requested_id", flat=True
    )
    received = FriendRequest.objects.filter(requested=user, is_accepted=True).values_list(
        "requester_id", flat=True
    )
    return set(sent).union(set(received))

