"""
Social discovery for linked Goodreads profiles.

Uses the same global Profile privacy settings as calendar and other apps:
- social_publish_visibility ("Sees me")
- social_read_scope ("Show me")
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from books.goodreads import fetch_shelf_books_cached, shelf_label
from users.avatar_url import profile_avatar_url
from users.models import Profile
from users.social_privacy import published_user_visibility_q, viewer_context
from users.views import get_or_create_profile

User = get_user_model()

COMMUNITY_SHELVES = frozenset({"currently-reading", "read", "to-read"})
MAX_COMMUNITY_READERS = 50


def _approved_users_qs() -> QuerySet:
    return User.objects.filter(
        account_status=User.AccountStatus.APPROVED,
        deleted_at__isnull=True,
    )


def visible_books_users_qs(viewer, *, search: str = "") -> QuerySet:
    """
    Approved users with a linked Goodreads id that the viewer may see,
    gated by Show me (read scope) and Sees me (publish visibility).
    """
    qs = (
        _approved_users_qs()
        .select_related("profile")
        .filter(profile__goodreads_user_id__gt="")
        .exclude(profile__goodreads_user_id__isnull=True)
    )

    get_or_create_profile(viewer)
    viewer_profile = getattr(viewer, "profile", None)
    scope = (
        getattr(viewer_profile, "social_read_scope", None)
        or Profile.SocialReadScope.APPROVED_USERS
    )
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        from friends.services import friend_ids_for_user

        allowed = set(friend_ids_for_user(user=viewer) or set())
        allowed.add(viewer.pk)
        qs = qs.filter(pk__in=list(allowed))

    if search:
        qs = qs.filter(
            Q(email__icontains=search) | Q(profile__display_name__icontains=search)
        )

    ctx = viewer_context(viewer=viewer)
    qs = qs.filter(published_user_visibility_q(viewer=viewer, ctx=ctx))
    return qs.order_by("profile__display_name", "email")


def reader_row(user) -> dict:
    profile = getattr(user, "profile", None)
    display_name = ""
    avatar_url = ""
    goodreads_user_id = ""
    if profile is not None:
        display_name = (profile.display_name or "").strip()
        avatar_url = profile_avatar_url(profile)
        goodreads_user_id = (profile.goodreads_user_id or "").strip()
    if not display_name:
        display_name = (user.email or "").split("@")[0]
    return {
        "id": user.id,
        "display_name": display_name,
        "avatar_url": avatar_url,
        "goodreads_user_id": goodreads_user_id or None,
        "profile_url": (
            f"https://www.goodreads.com/user/show/{goodreads_user_id}"
            if goodreads_user_id
            else None
        ),
    }


def community_shelf_payload(
    viewer,
    *,
    shelf: str = "currently-reading",
    use_cache: bool = True,
) -> dict:
    slug = (shelf or "currently-reading").strip().lower()
    if slug not in COMMUNITY_SHELVES:
        slug = "currently-reading"

    users = list(visible_books_users_qs(viewer)[:MAX_COMMUNITY_READERS])
    results: list[dict] = []
    for user in users:
        profile = getattr(user, "profile", None)
        gr_id = (getattr(profile, "goodreads_user_id", None) or "").strip()
        if not gr_id:
            continue
        books: list[dict] = []
        error: str | None = None
        try:
            books = fetch_shelf_books_cached(gr_id, slug, use_cache=use_cache)
        except Exception as exc:  # noqa: BLE001 — keep community resilient
            error = str(getattr(exc, "detail", None) or exc)
            books = []
        results.append(
            {
                "user": reader_row(user),
                "shelf": slug,
                "book_count": len(books),
                "books": books,
                "error": error,
            },
        )

    return {
        "shelf": slug,
        "shelf_label": shelf_label(slug),
        "results": results,
    }
