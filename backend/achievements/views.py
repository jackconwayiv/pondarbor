from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.auth0_backend import Auth0TokenAuthentication
from users.permissions import IsApprovedUser, IsStaffUser

from achievements.services import (
    achievement_definitions_catalog_payload,
    achievement_peers_for_my_friends,
    achievement_peers_for_subject_friends,
    achievements_payload_for_user,
    viewer_can_view_user_public_achievement_list,
)

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "achievements", "ok": True})


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_achievement_definitions(request):
    return Response(achievement_definitions_catalog_payload())


def _achievements_for_viewer(*, profile_user, viewer):
    if not viewer_can_view_user_public_achievement_list(viewer=viewer, profile_user=profile_user):
        return None
    is_owner = bool(
        viewer and getattr(viewer, "is_authenticated", False) and viewer.id == profile_user.id
    )
    hide_hidden = not is_owner
    return achievements_payload_for_user(
        profile_user,
        public_only=True,
        hide_user_hidden_from_friends=hide_hidden,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_achievements(request, email: str):
    user = get_object_or_404(User.objects.all(), email__iexact=email)
    viewer = getattr(request, "user", None)
    payload = _achievements_for_viewer(profile_user=user, viewer=viewer)
    if payload is None:
        return Response([])
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_achievements_by_id(request, user_id: int):
    user = get_object_or_404(User.objects.all(), pk=user_id)
    viewer = getattr(request, "user", None)
    payload = _achievements_for_viewer(profile_user=user, viewer=viewer)
    if payload is None:
        return Response([])
    return Response(payload)


def _parse_slugs_body(request) -> tuple[list | None, Response | None]:
    slugs = request.data.get("slugs")
    if not isinstance(slugs, list):
        return None, Response({"detail": "slugs must be a list of strings."}, status=status.HTTP_400_BAD_REQUEST)
    return slugs, None


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsApprovedUser])
def me_achievement_peers(request):
    slugs, err = _parse_slugs_body(request)
    if err is not None:
        return err
    payload = achievement_peers_for_my_friends(viewer=request.user, slugs=slugs)
    return Response({"peers_by_slug": payload})


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsApprovedUser])
def user_achievement_peers_for_subject_friends(request, user_id: int):
    subject = get_object_or_404(User.objects.all(), pk=user_id)
    slugs, err = _parse_slugs_body(request)
    if err is not None:
        return err
    try:
        payload = achievement_peers_for_subject_friends(
            viewer=request.user,
            subject=subject,
            slugs=slugs,
        )
    except ValueError:
        return Response(
            {"detail": "You can only load peers for friends you are connected with."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return Response({"peers_by_slug": payload})
