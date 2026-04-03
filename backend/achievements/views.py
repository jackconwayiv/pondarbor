from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from achievements.services import achievements_payload_for_user

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "achievements", "ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def user_public_achievements(request, email: str):
    user = get_object_or_404(User.objects.all(), email__iexact=email)
    return Response(achievements_payload_for_user(user, public_only=True))


@api_view(["GET"])
@permission_classes([AllowAny])
def user_public_achievements_by_id(request, user_id: int):
    user = get_object_or_404(User.objects.all(), pk=user_id)
    return Response(achievements_payload_for_user(user, public_only=True))
