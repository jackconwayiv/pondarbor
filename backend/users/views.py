import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .auth0_backend import Auth0TokenAuthentication
from .models import PROFILE_TIMEZONE_DEFAULT, Profile
from .permissions import IsApprovedUser, IsStaffUser
from friends.models import FriendRequest
from friends.services import are_friends
from achievements.services import achievements_payload_for_user

from .serializers import (
    LoginSerializer,
    MeSerializer,
    UpcomingBirthdaySerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
    StaffAccountStatusPatchSerializer,
)

UserModel = get_user_model()

SESSION_AUTH_BACKEND = "django.contrib.auth.backends.ModelBackend"

logger = logging.getLogger(__name__)


def get_or_create_profile(user):
    """Users created before Profile existed can lack a row; prevents 500 in /me and sync."""
    display_name_max = Profile._meta.get_field("display_name").max_length
    default_display_name = (user.email.split("@")[0] if user.email else "")
    default_display_name = (
        default_display_name
        if len(default_display_name) <= display_name_max
        else default_display_name[:display_name_max]
    )
    try:
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": default_display_name,
                "timezone": PROFILE_TIMEZONE_DEFAULT,
            },
        )
    except IntegrityError:
        # Concurrent bootstrap calls can race on profile creation.
        profile = Profile.objects.get(user=user)
    return profile


def serialize_me(user):
    profile = get_or_create_profile(user)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username or "",
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_authenticated": True,
            "is_approved": user.account_status == UserModel.AccountStatus.APPROVED,
            "is_staff": user.is_staff,
            "auth0_sub": user.auth0_sub or None,
            "account_status": user.account_status,
            "deleted_at": user.deleted_at,
        },
        "profile": {
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "timezone": profile.timezone,
            "birth_date": profile.birth_date,
            "whatif_completed_session": profile.whatif_completed_session,
        },
        "achievements": achievements_payload_for_user(user, public_only=False),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(serialize_me(request.user)).data)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def approved_check(request):
    return Response({"ok": True, "message": "You are approved."})


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def upcoming_birthdays(request):
    today = timezone.localdate()
    window_offsets_by_month_day = {}
    for offset in range(-2, 8):
        day = today + timedelta(days=offset)
        window_offsets_by_month_day[(day.month, day.day)] = offset

    profiles = Profile.objects.select_related("user").filter(
        user__account_status=UserModel.AccountStatus.APPROVED,
        user__deleted_at__isnull=True,
        birth_date__isnull=False,
    )

    rows = []
    for profile in profiles:
        birth_date = profile.birth_date
        month_day = (birth_date.month, birth_date.day)
        offset = window_offsets_by_month_day.get(month_day)
        if offset is None:
            continue
        rows.append(
            {
                "offset": offset,
                "display_name": profile.display_name,
                "birth_month": birth_date.month,
                "birth_day": birth_date.day,
            }
        )

    rows.sort(key=lambda row: (row["offset"], row["display_name"].lower()))
    payload = [
        {
            "display_name": row["display_name"],
            "birth_month": row["birth_month"],
            "birth_day": row["birth_day"],
        }
        for row in rows
    ]
    return Response(UpcomingBirthdaySerializer(payload, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    display_name = serializer.validated_data.get("display_name", "").strip()
    timezone = (
        serializer.validated_data.get("timezone", "").strip()
        or PROFILE_TIMEZONE_DEFAULT
    )

    user = UserModel.objects.create_user(
        email=email,
        password=password,
    )

    profile = get_or_create_profile(user)
    profile.display_name = display_name or email.split("@")[0]
    profile.timezone = timezone
    profile.save()

    login(request, user, backend=SESSION_AUTH_BACKEND)

    return Response(
        MeSerializer(serialize_me(user)).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = UserModel.objects.normalize_email(
        serializer.validated_data["email"].strip().lower()
    )
    password = serializer.validated_data["password"]

    user_obj = UserModel.objects.filter(email__iexact=email).first()
    if not user_obj:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=user_obj.email, password=password)
    if not user:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    login(request, user, backend=SESSION_AUTH_BACKEND)
    return Response(MeSerializer(serialize_me(user)).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return Response({"ok": True})


def _public_user_summary_response(*, request, user):
    profile = get_or_create_profile(user)
    viewer = getattr(request, "user", None)
    is_viewer_authenticated = bool(
        viewer and getattr(viewer, "is_authenticated", False)
    )
    is_owner = is_viewer_authenticated and viewer.id == user.id
    viewer_approved = is_viewer_authenticated and (
        viewer.account_status == UserModel.AccountStatus.APPROVED
    )
    is_friend = is_owner or (viewer_approved and are_friends(user_a=viewer, user_b=user))
    friendship_status = "none"
    if is_owner:
        friendship_status = "self"
    elif is_friend:
        friendship_status = "friends"
    elif viewer_approved:
        direct = FriendRequest.objects.filter(requester=viewer, requested=user).first()
        reverse = FriendRequest.objects.filter(requester=user, requested=viewer).first()
        direct_active = bool(
            direct
            and not direct.is_accepted
            and not direct.ignored_by_requester
            and not direct.ignored_by_requested
        )
        reverse_active = bool(
            reverse
            and not reverse.is_accepted
            and not reverse.ignored_by_requester
            and not reverse.ignored_by_requested
        )
        if reverse_active:
            friendship_status = "incoming_pending"
        elif direct_active:
            friendship_status = "outgoing_pending"

    nickname = (profile.display_name or "").strip() or user.email.split("@")[0]
    payload = {
        "nickname": nickname,
        "avatar_url": profile.avatar_url or "",
        "is_friend": bool(is_friend),
        "can_view_full_profile": bool(is_friend),
        "friendship_status": friendship_status,
    }
    if is_friend:
        payload["email"] = user.email
        payload["display_name"] = (profile.display_name or "").strip()
    if is_friend and not is_owner:
        from closet.models import Item
        from closet.services import owner_eligible_for_closet_publication_q

        payload["closet_items_count"] = (
            Item.objects.filter(deleted_at__isnull=True, owner_user=user)
            .filter(owner_eligible_for_closet_publication_q())
            .count()
        )
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_summary_by_id(request, user_id: int):
    """Friend profile summary; non-friends receive only nickname + avatar."""
    user = get_object_or_404(UserModel.objects.all(), pk=user_id)
    return _public_user_summary_response(request=request, user=user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_summary_by_email(request, email: str):
    user = get_object_or_404(UserModel.objects.all(), email__iexact=email)
    return _public_user_summary_response(request=request, user=user)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication])
@permission_classes([IsAuthenticated])
def sync_profile(request):
    """Bootstrap session after Auth0 login. Identity is enforced in Auth0TokenAuthentication."""
    try:
        return Response(MeSerializer(serialize_me(request.user)).data)
    except Exception:
        logger.exception(
            "sync_profile failed user_pk=%s",
            getattr(request.user, "pk", None),
        )
        raise


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def patch_me_profile(request):
    """Update only the authenticated user's profile preferences."""
    profile = get_or_create_profile(request.user)
    serializer = ProfileUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.validated_data.items():
        setattr(profile, field, value)
    profile.save()
    return Response(MeSerializer(serialize_me(request.user)).data)


def _serialize_staff_user_row(user):
    profile = get_or_create_profile(user)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username or "",
        "account_status": user.account_status,
        "is_staff": user.is_staff,
        "display_name": profile.display_name,
        "date_joined": user.date_joined,
    }


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_pending_summary(request):
    from whatif.models import WhatIfQuestion

    pending_members = UserModel.objects.filter(
        account_status=UserModel.AccountStatus.PENDING
    ).count()
    pending_whatif = WhatIfQuestion.objects.filter(
        review_status=WhatIfQuestion.ReviewStatus.PENDING,
        deleted_at__isnull=True,
    ).count()
    return Response(
        {
            "pending_members": pending_members,
            "pending_whatif_questions": pending_whatif,
        }
    )


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_users_list(request):
    users = UserModel.objects.select_related("profile").order_by("-date_joined", "-id")
    return Response([_serialize_staff_user_row(u) for u in users])


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_user_patch(request, user_id: int):
    # Do not allow changing your own approval status (avoids accidental self-lockout).
    if user_id == request.user.id:
        return Response(
            {"detail": "You cannot change your own account status here."},
            status=status.HTTP_403_FORBIDDEN,
        )
    target = get_object_or_404(UserModel.objects.all(), pk=user_id)
    serializer = StaffAccountStatusPatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    target.account_status = serializer.validated_data["account_status"]
    target.save(update_fields=["account_status"])
    return Response(_serialize_staff_user_row(target))
