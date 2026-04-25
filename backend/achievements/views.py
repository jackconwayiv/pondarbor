from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from achievements.services import achievements_payload_for_user
from friends.services import are_friends
from users.models import User as SiteUser
from users.models import Profile

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "achievements", "ok": True})


def _achievements_for_viewer(*, profile_user, viewer):
    is_owner = bool(
        viewer and getattr(viewer, "is_authenticated", False) and viewer.id == profile_user.id
    )
    viewer_approved = bool(
        viewer
        and getattr(viewer, "is_authenticated", False)
        and viewer.account_status == SiteUser.AccountStatus.APPROVED
    )
    is_friend = bool(viewer_approved and are_friends(user_a=viewer, user_b=profile_user))
    if is_owner:
        can_view = True
    elif not viewer_approved:
        can_view = False
    else:
        owner_profile = getattr(profile_user, "profile", None)
        publish_vis = (
            getattr(owner_profile, "social_publish_visibility", None)
            or Profile.SocialPublishVisibility.ALL_APPROVED
        )
        can_view = (
            publish_vis == Profile.SocialPublishVisibility.ALL_APPROVED
            or (publish_vis == Profile.SocialPublishVisibility.FRIENDS_ONLY and is_friend)
        )
    if not can_view:
        return None
    hide_hidden = (not is_owner)
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
