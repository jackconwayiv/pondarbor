import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .auth0_backend import Auth0TokenAuthentication
from .models import PROFILE_TIMEZONE_DEFAULT, Profile
from .permissions import IsApprovedUser
from .serializers import (
    LoginSerializer,
    MeSerializer,
    UpcomingBirthdaySerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
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
        },
        "profile": {
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "timezone": profile.timezone,
            "birth_date": profile.birth_date,
            "whatif_completed_session": profile.whatif_completed_session,
        },
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
