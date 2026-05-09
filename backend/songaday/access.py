"""Who may see another user's Song-a-Day submission (visibility + friendship)."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from friends.services import friend_ids_for_user
from users.models import Profile
from users.social_privacy import (
    ViewerContext,
    published_owner_visibility_q,
    viewer_context,
    viewer_may_see_owners_published_content,
)

User = get_user_model()


def viewer_is_approved(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "account_status", None) == User.AccountStatus.APPROVED
    )


def _owner_songaday_visibility(owner) -> str:
    profile = getattr(owner, "profile", None)
    if profile is None:
        return Profile.SongadayVisibility.FRIENDS_ONLY
    return profile.songaday_visibility or Profile.SongadayVisibility.FRIENDS_ONLY


def can_view_song_response(*, viewer, response) -> bool:
    """
    Owner always sees own submission.
    Others need approved viewer, owner's global publish visibility ("Sees me"), then
    songaday_visibility (private / friends_only / all_approved).
    """
    if response.user_id == viewer.id:
        return True
    if not viewer_is_approved(viewer):
        return False
    owner = response.user
    if not viewer_may_see_owners_published_content(viewer=viewer, owner=owner):
        return False
    vis = _owner_songaday_visibility(owner)
    if vis == Profile.SongadayVisibility.PRIVATE:
        return False
    if vis == Profile.SongadayVisibility.ALL_APPROVED:
        return owner.account_status == User.AccountStatus.APPROVED
    # friends_only
    return response.user_id in friend_ids_for_user(user=viewer)


def visible_song_responses_q(
    *,
    viewer,
    friend_ids,
    ctx: ViewerContext | None = None,
) -> Q:
    """
    Filter SongResponse rows the viewer may see for a given calendar day list.
    Intersects global publish visibility ("Sees me") with songaday_visibility rules.
    Keep logic aligned with can_view_song_response.
    """
    ctx = ctx or viewer_context(viewer=viewer)
    pub = published_owner_visibility_q(viewer=viewer, owner_fk_field="user", ctx=ctx)
    mine = Q(user_id=viewer.id)
    fid_list = list(friend_ids) if friend_ids else []
    vis_f = Profile.SongadayVisibility.FRIENDS_ONLY
    vis_a = Profile.SongadayVisibility.ALL_APPROVED
    q = mine
    if viewer_is_approved(viewer):
        q |= Q(**{"user__profile__songaday_visibility": vis_a}) & ~Q(user_id=viewer.id)
    if fid_list:
        q |= Q(user_id__in=fid_list) & Q(**{"user__profile__songaday_visibility": vis_f})
    return pub & q
