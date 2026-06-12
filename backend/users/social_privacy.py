from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db.models import Q

from friends.services import friend_ids_for_user
from users.models import Profile

User = get_user_model()


@dataclass(frozen=True)
class ViewerContext:
    viewer_id: int
    is_authenticated: bool
    is_approved: bool
    friend_ids: set[int]


def viewer_context(*, viewer) -> ViewerContext:
    is_authenticated = bool(viewer and getattr(viewer, "is_authenticated", False))
    is_approved = bool(
        is_authenticated
        and getattr(viewer, "account_status", None) == User.AccountStatus.APPROVED
    )
    fid = friend_ids_for_user(user=viewer) if is_approved else set()
    return ViewerContext(
        viewer_id=int(getattr(viewer, "id", 0) or 0),
        is_authenticated=is_authenticated,
        is_approved=is_approved,
        friend_ids=set(fid or set()),
    )


def owner_publish_visibility(owner) -> str:
    """
    Owner's global publish visibility preference.
    Defaults to ALL_APPROVED (discoverable) if profile is missing.
    """
    profile = getattr(owner, "profile", None)
    if profile is None:
        return Profile.SocialPublishVisibility.ALL_APPROVED
    return (
        profile.social_publish_visibility
        or Profile.SocialPublishVisibility.ALL_APPROVED
    )


def viewer_may_see_owners_published_content(*, viewer, owner, ctx: ViewerContext | None = None) -> bool:
    """
    Whether ``viewer`` may see social objects owned by ``owner`` per Profile.social_publish_visibility
    ("Sees me"). Align with published_owner_visibility_q / published_user_visibility_q.
    """
    ctx = ctx or viewer_context(viewer=viewer)
    if ctx.viewer_id == owner.id:
        return True
    if not ctx.is_approved:
        return False
    pub = owner_publish_visibility(owner)
    if pub == Profile.SocialPublishVisibility.ALL_APPROVED:
        return True
    return owner.id in ctx.friend_ids


def published_user_visibility_q(*, viewer, ctx: ViewerContext | None = None) -> Q:
    """
    Filter a User queryset: which account rows the viewer may see for discovery / shared surfaces
    per global publish visibility. Uses profile fields on User (not an owner FK).
    """
    ctx = ctx or viewer_context(viewer=viewer)
    mine = Q(pk=ctx.viewer_id)
    if not ctx.is_approved:
        return mine

    vis_field = "profile__social_publish_visibility"
    prof_null_field = "profile__isnull"
    all_approved = (
        Q(**{vis_field: Profile.SocialPublishVisibility.ALL_APPROVED})
        | Q(**{prof_null_field: True})
    )
    friends_only = Q(**{vis_field: Profile.SocialPublishVisibility.FRIENDS_ONLY}) & Q(
        pk__in=list(ctx.friend_ids)
    )
    return mine | all_approved | friends_only


def can_view_owner_profile(*, viewer, owner) -> bool:
    """Whether viewer may see owner's profile/identity surfaces."""
    if not viewer or not getattr(viewer, "is_authenticated", False):
        return False
    if viewer.id == owner.id:
        return True
    # Require approved viewer for social surfaces.
    if getattr(viewer, "account_status", None) != User.AccountStatus.APPROVED:
        return False
    profile = getattr(owner, "profile", None)
    if profile is None:
        return True
    vis = getattr(profile, "social_publish_visibility", None) or Profile.SocialPublishVisibility.ALL_APPROVED
    if vis == Profile.SocialPublishVisibility.ALL_APPROVED:
        return True
    fids = friend_ids_for_user(user=viewer)
    return bool(fids and owner.id in fids)


def apply_read_scope_filter(
    *,
    viewer,
    qs,
    owner_field: str,
    include_self: bool = True,
    ctx: ViewerContext | None = None,
):
    """
    Soft filter for feed/discover surfaces based on viewer's Profile.social_read_scope.

    - approved_users: no extra filtering (besides existing endpoint gates)
    - friends_only: only show friends (plus self if include_self)
    """
    ctx = ctx or viewer_context(viewer=viewer)
    if not ctx.is_approved:
        return qs
    scope = getattr(getattr(viewer, "profile", None), "social_read_scope", None)
    scope = scope or Profile.SocialReadScope.APPROVED_USERS
    if scope == Profile.SocialReadScope.APPROVED_USERS:
        return qs
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        allowed_ids = set(ctx.friend_ids)
        if include_self:
            allowed_ids.add(ctx.viewer_id)
        return qs.filter(Q(**{f"{owner_field}__in": list(allowed_ids)}))
    return qs


def visible_user_ids_for_achievement_surfaces(*, viewer) -> set[int]:
    """
    User ids whose public achievement unlocks count toward viewer-scoped surfaces
    (Hall of Fame, etc.): published visibility ("Sees me") plus viewer read scope ("Show me").
    """
    ctx = viewer_context(viewer=viewer)
    if not ctx.is_authenticated or not ctx.viewer_id:
        return set()

    qs = User.objects.filter(published_user_visibility_q(viewer=viewer, ctx=ctx))
    scope = getattr(getattr(viewer, "profile", None), "social_read_scope", None)
    scope = scope or Profile.SocialReadScope.APPROVED_USERS
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        allowed = set(ctx.friend_ids)
        allowed.add(ctx.viewer_id)
        qs = qs.filter(pk__in=list(allowed))
    return set(qs.values_list("pk", flat=True))


def published_owner_visibility_q(
    *,
    viewer,
    owner_fk_field: str,
    ctx: ViewerContext | None = None,
) -> Q:
    """
    Returns a Q that matches rows owned by users whose global publish visibility allows
    the *viewer* to see their published objects.

    - Viewer always sees their own objects (for published lists this is usually fine).
    - For approved viewers:
      - owners with social_publish_visibility=all_approved are visible to all approved viewers
      - owners with social_publish_visibility=friends_only are visible only to friends
    """
    ctx = ctx or viewer_context(viewer=viewer)
    # Owner always visible to self.
    mine = Q(**{owner_fk_field: ctx.viewer_id})
    if not ctx.is_approved:
        return mine

    base_owner_field = owner_fk_field
    # e.g. owner -> owner__profile__social_publish_visibility
    vis_field = f"{base_owner_field}__profile__social_publish_visibility"
    prof_null_field = f"{base_owner_field}__profile__isnull"

    all_approved = (
        Q(**{vis_field: Profile.SocialPublishVisibility.ALL_APPROVED})
        | Q(**{prof_null_field: True})
    )
    friends_only = Q(**{vis_field: Profile.SocialPublishVisibility.FRIENDS_ONLY}) & Q(
        **{f"{base_owner_field}__in": list(ctx.friend_ids)}
    )
    return mine | all_approved | friends_only

