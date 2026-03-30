from django.contrib.auth import authenticate, get_user_model, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import PROFILE_TIMEZONE_DEFAULT
from .permissions import IsApprovedUser
from .serializers import (
    LoginSerializer,
    MeSerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
)

UserModel = get_user_model()

SESSION_AUTH_BACKEND = "django.contrib.auth.backends.ModelBackend"


def serialize_me(user):
    profile = user.profile
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username or "",
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_authenticated": True,
            "is_approved": user.account_status == UserModel.AccountStatus.APPROVED,
            "auth0_sub": user.auth0_sub or None,
            "account_status": user.account_status,
        },
        "profile": {
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "timezone": profile.timezone,
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

    profile = user.profile
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
@permission_classes([IsAuthenticated])
def sync_profile(request):
    """Bootstrap session after Auth0 login. Identity is enforced in Auth0TokenAuthentication."""
    return Response(MeSerializer(serialize_me(request.user)).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def patch_me_profile(request):
    """Update only the authenticated user's profile preferences."""
    profile = request.user.profile
    serializer = ProfileUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.validated_data.items():
        setattr(profile, field, value)
    profile.save()
    return Response(MeSerializer(serialize_me(request.user)).data)
