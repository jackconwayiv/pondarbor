from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from achievements.services import achievements_payload_for_user
from friends.services import are_friends
from users.models import User as SiteUser

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "achievements", "ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_achievements(request, email: str):
    user = get_object_or_404(User.objects.all(), email__iexact=email)
    viewer = getattr(request, "user", None)
    is_owner = bool(viewer and getattr(viewer, "is_authenticated", False) and viewer.id == user.id)
    is_friend = bool(
        viewer
        and getattr(viewer, "is_authenticated", False)
        and viewer.account_status == SiteUser.AccountStatus.APPROVED
        and are_friends(user_a=viewer, user_b=user)
    )
    if not is_owner and not is_friend:
        return Response([])
    return Response(achievements_payload_for_user(user, public_only=True))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_achievements_by_id(request, user_id: int):
    user = get_object_or_404(User.objects.all(), pk=user_id)
    viewer = getattr(request, "user", None)
    is_owner = bool(viewer and getattr(viewer, "is_authenticated", False) and viewer.id == user.id)
    is_friend = bool(
        viewer
        and getattr(viewer, "is_authenticated", False)
        and viewer.account_status == SiteUser.AccountStatus.APPROVED
        and are_friends(user_a=viewer, user_b=user)
    )
    if not is_owner and not is_friend:
        return Response([])
    return Response(achievements_payload_for_user(user, public_only=True))
