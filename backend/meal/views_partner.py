from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from users.auth0_backend import Auth0TokenAuthentication
from users.models import Profile
from users.permissions import IsApprovedUser
from users.views import get_or_create_profile

from meal.fork import fork_both_users_on_disconnect
from meal.models import MealPartnerDisconnectRequest
from meal.partner import mutual_meal_pair

UserModel = get_user_model()
@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def disconnect_request(request):
    """Initiator requests disconnect; requires mutual meal pair."""
    user = request.user
    profile = get_or_create_profile(user)
    partner_id = profile.meal_crud_partner_id
    if not partner_id or not mutual_meal_pair(user=user):
        raise ValidationError({"detail": "No active mutual meal partner to disconnect from."})
    if MealPartnerDisconnectRequest.objects.filter(
        Q(initiator=user, recipient_id=partner_id) | Q(initiator_id=partner_id, recipient=user),
        status=MealPartnerDisconnectRequest.Status.PENDING,
    ).exists():
        raise ValidationError({"detail": "A disconnect request is already pending."})
    req = MealPartnerDisconnectRequest.objects.create(
        initiator=user,
        recipient_id=partner_id,
        status=MealPartnerDisconnectRequest.Status.PENDING,
    )
    return Response(
        {"id": req.id, "status": req.status, "initiator_id": req.initiator_id, "recipient_id": req.recipient_id},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def disconnect_cancel(request):
    """Initiator cancels a pending disconnect request."""
    user = request.user
    req = (
        MealPartnerDisconnectRequest.objects.filter(
            initiator=user,
            status=MealPartnerDisconnectRequest.Status.PENDING,
        )
        .order_by("-id")
        .first()
    )
    if not req:
        raise ValidationError({"detail": "No pending disconnect request to cancel."})
    req.status = MealPartnerDisconnectRequest.Status.CANCELLED
    req.save(update_fields=["status", "updated_at"])
    return Response({"ok": True})


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def disconnect_confirm(request):
    """Recipient confirms pending disconnect; forks data and clears both partner FKs."""
    user = request.user
    req = (
        MealPartnerDisconnectRequest.objects.filter(
            recipient=user,
            status=MealPartnerDisconnectRequest.Status.PENDING,
        )
        .select_related("initiator")
        .order_by("-id")
        .first()
    )
    if not req:
        raise ValidationError({"detail": "No pending disconnect request to confirm."})

    a, b = req.initiator, req.recipient
    if not mutual_meal_pair(user=a) or a.profile.meal_crud_partner_id != b.id:
        raise ValidationError({"detail": "Meal partnership is no longer mutual."})

    with transaction.atomic():
        fork_both_users_on_disconnect([a, b])
        Profile.objects.filter(
            user_id__in=[a.id, b.id],
            meal_crud_partner_id__in=[a.id, b.id],
        ).update(meal_crud_partner=None)
        MealPartnerDisconnectRequest.objects.filter(
            Q(initiator=a, recipient=b) | Q(initiator=b, recipient=a)
        ).delete()

    return Response({"ok": True, "status": "disconnected"})


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def disconnect_pending(request):
    """Return pending disconnect involving current user (if any)."""
    user = request.user
    req = (
        MealPartnerDisconnectRequest.objects.filter(
            Q(initiator=user) | Q(recipient=user),
            status=MealPartnerDisconnectRequest.Status.PENDING,
        )
        .order_by("-id")
        .first()
    )
    if not req:
        return Response(None)
    return Response(
        {
            "id": req.id,
            "status": req.status,
            "initiator_id": req.initiator_id,
            "recipient_id": req.recipient_id,
            "i_am_initiator": req.initiator_id == user.id,
        }
    )


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def decline_incoming_partner_request(request):
    """Recipient declines a one-way incoming partner request from a friend."""
    requester_id = request.data.get("requester_id")
    if not isinstance(requester_id, int):
        raise ValidationError({"detail": "requester_id must be an integer."})

    requester = get_object_or_404(UserModel.objects.select_related("profile"), pk=requester_id)
    requester_profile = get_or_create_profile(requester)
    if requester_profile.meal_crud_partner_id != request.user.id:
        raise ValidationError({"detail": "No incoming meal partner request from this user."})
    if mutual_meal_pair(user=requester):
        raise ValidationError({"detail": "Cannot decline a mutual meal partnership here."})

    requester_profile.meal_crud_partner = None
    requester_profile.save(update_fields=["meal_crud_partner", "updated_at"])
    return Response({"ok": True})
