"""
Social discovery for linked Goodreads profiles.

Uses the same global Profile privacy settings as calendar and other apps:
- social_publish_visibility ("Sees me")
- social_read_scope ("Show me")
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from books.goodreads import fetch_shelf_books_cached, shelf_label
from users.avatar_url import profile_avatar_url
from users.models import Profile
from users.social_privacy import published_user_visibility_q, viewer_context
from users.views import get_or_create_profile

User = get_user_model()

COMMUNITY_SHELF_ORDER = (
    "currently-reading",
    "to-read",
    "did-not-finish",
    "read",
)
MAX_COMMUNITY_READERS = 50
_COMMUNITY_FETCH_WORKERS = 8


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


def community_feed_has_books(shelves: list | None) -> bool:
    """True if any of the four Books community shelves has at least one title."""
    wanted = set(COMMUNITY_SHELF_ORDER)
    for row in shelves or []:
        if not isinstance(row, dict):
            continue
        if row.get("slug") not in wanted:
            continue
        books = row.get("books") or []
        if len(books) >= 1:
            return True
    return False


def currently_reading_preview(viewer, user) -> list[dict[str, str]]:
    """
    Title/author rows from the subject's currently-reading shelf, or [].

    Empty when the viewer cannot see this reader in Books, the shelf errors,
    or there are no titles. Uses the same RSS cache as community shelves.
    """
    if not visible_books_users_qs(viewer).filter(pk=user.pk).exists():
        return []
    profile = getattr(user, "profile", None)
    gr_id = (getattr(profile, "goodreads_user_id", None) or "").strip()
    if not gr_id:
        return []
    try:
        books = fetch_shelf_books_cached(gr_id, "currently-reading", use_cache=True)
    except Exception:  # noqa: BLE001 — profile should not fail on RSS
        return []
    preview: list[dict[str, str]] = []
    for book in books:
        title = str(book.get("title") or "").strip()
        if not title:
            continue
        preview.append(
            {
                "title": title,
                "author_name": str(book.get("author_name") or "").strip(),
            }
        )
    return preview


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


def _fetch_community_shelf(
    goodreads_user_id: str,
    slug: str,
    *,
    use_cache: bool,
) -> tuple[str, list, str | None]:
    try:
        books = fetch_shelf_books_cached(
            goodreads_user_id,
            slug,
            use_cache=use_cache,
        )
        return slug, books, None
    except Exception as exc:  # noqa: BLE001 — keep community resilient
        error = str(getattr(exc, "detail", None) or exc)
        return slug, [], error


def community_payload(viewer, *, use_cache: bool = True) -> dict:
    users = list(visible_books_users_qs(viewer)[:MAX_COMMUNITY_READERS])
    jobs: list[tuple[object, str, str]] = []
    for user in users:
        profile = getattr(user, "profile", None)
        gr_id = (getattr(profile, "goodreads_user_id", None) or "").strip()
        if not gr_id:
            continue
        for slug in COMMUNITY_SHELF_ORDER:
            jobs.append((user, gr_id, slug))

    fetched: dict[tuple[int, str], tuple[list, str | None]] = {}
    if jobs:
        workers = min(_COMMUNITY_FETCH_WORKERS, len(jobs))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(
                    _fetch_community_shelf,
                    gr_id,
                    slug,
                    use_cache=use_cache,
                ): (user, slug)
                for user, gr_id, slug in jobs
            }
            for future in as_completed(futures):
                user, slug = futures[future]
                _slug, books, error = future.result()
                fetched[(user.pk, slug)] = (books, error)

    results: list[dict] = []
    for user in users:
        profile = getattr(user, "profile", None)
        gr_id = (getattr(profile, "goodreads_user_id", None) or "").strip()
        if not gr_id:
            continue
        shelves = []
        for slug in COMMUNITY_SHELF_ORDER:
            books, error = fetched.get((user.pk, slug), ([], None))
            shelves.append(
                {
                    "slug": slug,
                    "label": shelf_label(slug),
                    "book_count": len(books),
                    "books": books,
                    "error": error,
                },
            )
        results.append({"user": reader_row(user), "shelves": shelves})

    return {"results": results}
