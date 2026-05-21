from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from users.permissions import IsApprovedUser
from rest_framework.response import Response

from estates.constants import ESTATES_COMPUTER_USER_EMAIL
from friends.models import FriendRequest
from friends.services import friends_queryset_for_user, order_users_by_recent_activity
from users.models import Profile
from users.social_privacy import published_user_visibility_q, viewer_context

UserModel = get_user_model()


def _exclude_hidden_approved_user_emails(qs):
    """Users that should not appear in Approved Users discovery (friends tab)."""
    qs = qs.exclude(email__iexact=ESTATES_COMPUTER_USER_EMAIL)
    contact = (getattr(settings, "CONTACT_INBOX_EMAIL", "") or "").strip()
    if contact:
        qs = qs.exclude(email__iexact=contact)
    return qs


def _profile_for_user(user):
    profile, _ = Profile.objects.get_or_create(user=user, defaults={"display_name": ""})
    return profile


def friend_user_row_dict(user):
    """JSON row for approved-friends lists (my friends, friends-of-friends, search)."""
    profile = getattr(user, "profile", None) or _profile_for_user(user)
    return {
        "id": user.id,
        "email": user.email,
        "nickname": (profile.display_name or user.email.split("@")[0]).strip(),
        "avatar_url": profile.avatar_url or "",
        "meal_crud_partner_id": profile.meal_crud_partner_id,
    }


class FriendRequestInputSerializer(serializers.Serializer):
    email = serializers.EmailField()


def _accept_pair(*, user_a, user_b):
    first, _ = FriendRequest.objects.get_or_create(
        requester=user_a, requested=user_b, defaults={"is_accepted": True}
    )
    second, _ = FriendRequest.objects.get_or_create(
        requester=user_b, requested=user_a, defaults={"is_accepted": True}
    )
    if not first.is_accepted or first.ignored_by_requester or first.ignored_by_requested:
        first.is_accepted = True
        first.ignored_by_requester = False
        first.ignored_by_requested = False
        first.save(
            update_fields=["is_accepted", "ignored_by_requester", "ignored_by_requested", "updated_at"]
        )
    if not second.is_accepted or second.ignored_by_requester or second.ignored_by_requested:
        second.is_accepted = True
        second.ignored_by_requester = False
        second.ignored_by_requested = False
        second.save(
            update_fields=["is_accepted", "ignored_by_requester", "ignored_by_requested", "updated_at"]
        )


def _request_friend_target(*, requester, requested):
    if requested.id == requester.id:
        return Response({"detail": "You cannot friend request yourself."}, status=400)
    if requested.account_status != UserModel.AccountStatus.APPROVED:
        return Response({"detail": "That user is not available for friend requests."}, status=400)

    direct = FriendRequest.objects.filter(requester=requester, requested=requested).first()
    reverse = FriendRequest.objects.filter(requester=requested, requested=requester).first()
    if (direct and direct.is_accepted) or (reverse and reverse.is_accepted):
        _accept_pair(user_a=requester, user_b=requested)
        return Response({"ok": True, "state": "already_friends"})

    if direct is None:
        direct = FriendRequest.objects.create(requester=requester, requested=requested)
    elif direct.is_accepted:
        direct.is_accepted = False
        direct.save(update_fields=["is_accepted", "updated_at"])

    if direct.ignored_by_requester or direct.ignored_by_requested:
        direct.ignored_by_requester = False
        direct.ignored_by_requested = False
        direct.save(update_fields=["ignored_by_requester", "ignored_by_requested", "updated_at"])
    return Response({"ok": True, "state": "requested"})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def friends_list(request):
    user = request.user
    incoming = (
        FriendRequest.objects.select_related("requester")
        .filter(
            requested=user,
            is_accepted=False,
            ignored_by_requester=False,
            ignored_by_requested=False,
        )
        .order_by("-updated_at")
    )
    outgoing = (
        FriendRequest.objects.select_related("requested")
        .filter(
            requester=user,
            is_accepted=False,
            ignored_by_requester=False,
            ignored_by_requested=False,
        )
        .order_by("-updated_at")
    )
    approved_users = order_users_by_recent_activity(
        friends_queryset_for_user(user=user).select_related("profile")
    )
    return Response(
        {
            "incoming_pending": [friend_user_row_dict(row.requester) for row in incoming],
            "outgoing_pending": [friend_user_row_dict(row.requested) for row in outgoing],
            "approved_friends": [friend_user_row_dict(friend) for friend in approved_users],
            "pending_count": incoming.count(),
        }
    )


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def request_friend(request):
    serializer = FriendRequestInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    requester = request.user
    requested = get_object_or_404(UserModel.objects.all(), email__iexact=serializer.validated_data["email"])
    return _request_friend_target(requester=requester, requested=requested)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def request_friend_by_id(request, user_id: int):
    requester = request.user
    requested = get_object_or_404(UserModel.objects.all(), pk=user_id)
    return _request_friend_target(requester=requester, requested=requested)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def accept_friend(request, user_id: int):
    current = request.user
    other = get_object_or_404(UserModel.objects.all(), pk=user_id)
    if other.id == current.id:
        return Response({"detail": "Invalid friend target."}, status=400)
    _accept_pair(user_a=current, user_b=other)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def ignore_friend(request, user_id: int):
    current = request.user
    other = get_object_or_404(UserModel.objects.all(), pk=user_id)
    if other.id == current.id:
        return Response({"detail": "Invalid friend target."}, status=400)

    # Ignore behaves like dismissing request state entirely.
    FriendRequest.objects.filter(
        Q(requester=current, requested=other) | Q(requester=other, requested=current)
    ).delete()
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def unfriend(request, user_id: int):
    current = request.user
    other = get_object_or_404(UserModel.objects.all(), pk=user_id)
    # Unfriend should fully clear relationship/request state in both directions.
    # Leaving rows in a non-accepted state can surface stale "pending" entries.
    FriendRequest.objects.filter(
        Q(requester=current, requested=other) | Q(requester=other, requested=current)
    ).delete()
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def friends_search(request):
    user = request.user
    search = (request.query_params.get("q") or "").strip()
    if not search:
        return Response([])

    friends_qs = friends_queryset_for_user(user=user).select_related("profile")
    friends_qs = friends_qs.filter(
        Q(email__icontains=search) | Q(profile__display_name__icontains=search)
    ).order_by("profile__display_name", "email")[:20]
    return Response([friend_user_row_dict(friend) for friend in friends_qs])


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def approved_users_search(request):
    user = request.user
    search = (request.query_params.get("q") or "").strip()
    if len(search) < 2:
        return Response([])

    qs = (
        UserModel.objects.select_related("profile")
        .filter(
            account_status=UserModel.AccountStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .exclude(pk=user.pk)
    )
    qs = (
        _exclude_hidden_approved_user_emails(qs)
        .filter(Q(email__icontains=search) | Q(profile__display_name__icontains=search))
        .order_by("profile__display_name", "email")[:20]
    )
    return Response([friend_user_row_dict(row) for row in qs])


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def approved_users_list(request):
    user = request.user
    approved_friend_ids = set(
        friends_queryset_for_user(user=user).values_list("id", flat=True)
    )
    pending_user_ids = set(
        FriendRequest.objects.filter(
            Q(requester=user, is_accepted=False, ignored_by_requester=False, ignored_by_requested=False)
            | Q(requested=user, is_accepted=False, ignored_by_requester=False, ignored_by_requested=False)
        ).values_list("requester_id", "requested_id")
    )
    excluded_ids = {user.id, *approved_friend_ids}
    for requester_id, requested_id in pending_user_ids:
        if requester_id != user.id:
            excluded_ids.add(requester_id)
        if requested_id != user.id:
            excluded_ids.add(requested_id)

    qs = (
        UserModel.objects.select_related("profile")
        .filter(
            account_status=UserModel.AccountStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .exclude(pk__in=excluded_ids)
    )
    qs = _exclude_hidden_approved_user_emails(qs)
    ctx = viewer_context(viewer=user)
    qs = qs.filter(published_user_visibility_q(viewer=user, ctx=ctx))
    qs = order_users_by_recent_activity(qs)
    return Response([friend_user_row_dict(row) for row in qs])

