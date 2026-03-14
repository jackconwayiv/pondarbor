from django.contrib.auth import authenticate, get_user_model, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .permissions import IsApprovedUser
from .serializers import LoginSerializer, MeSerializer, SignupSerializer

User = get_user_model()


def serialize_me(user):
    profile = user.profile
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_authenticated": True,
            "is_approved": profile.status == "approved",
        },
        "profile": {
            "auth0_sub": profile.auth0_sub,
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "timezone": profile.timezone,
            "status": profile.status,
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
    timezone = serializer.validated_data.get("timezone", "").strip() or "UTC"

    username_base = email.split("@")[0]
    username = username_base
    counter = 1
    while User.objects.filter(username=username).exists():
        counter += 1
        username = f"{username_base}{counter}"

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
    )

    profile = user.profile
    profile.display_name = display_name or username_base
    profile.timezone = timezone
    profile.status = "pending"
    profile.save()

    login(request, user)

    return Response(
        MeSerializer(serialize_me(user)).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"].strip().lower()
    password = serializer.validated_data["password"]

    user_obj = User.objects.filter(email__iexact=email).first()
    if not user_obj:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=user_obj.username, password=password)
    if not user:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    login(request, user)
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
    """Sync Auth0 profile data into our Profile model."""
    user = request.user
    profile = user.profile

    auth0_sub = request.data.get("sub")
    email = request.data.get("email")
    display_name = request.data.get("display_name") or request.data.get("name")
    avatar_url = request.data.get("avatar_url") or request.data.get("picture")
    first_name = request.data.get("given_name")
    last_name = request.data.get("family_name")

    if email:
        user.email = email

    if first_name:
        user.first_name = first_name

    if last_name:
        user.last_name = last_name

    if auth0_sub:
        profile.auth0_sub = auth0_sub

    if display_name:
        profile.display_name = display_name

    if avatar_url:
        profile.avatar_url = avatar_url

    user.save()
    profile.save()

    return Response(MeSerializer(serialize_me(user)).data)
