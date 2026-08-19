from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from books.goodreads import (
    fetch_all_shelves,
    invalidate_shelves_cache,
    parse_goodreads_user_id,
)
from books.social import (
    community_payload,
    reader_row,
    visible_books_users_qs,
)
from achievements.services import evaluate_reads_good_for_user
from users.permissions import IsApprovedUser
from users.serializers import MeSerializer
from users.views import get_or_create_profile, serialize_me

UserModel = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def books_status(request):
    profile = get_or_create_profile(request.user)
    user_id = (profile.goodreads_user_id or "").strip()
    return Response(
        {
            "linked": bool(user_id),
            "goodreads_user_id": user_id or None,
            "profile_url": (
                f"https://www.goodreads.com/user/show/{user_id}" if user_id else None
            ),
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def books_link(request):
    profile_url = request.data.get("profile_url")
    user_id = parse_goodreads_user_id(profile_url if isinstance(profile_url, str) else "")
    profile = get_or_create_profile(request.user)
    old = (profile.goodreads_user_id or "").strip()
    if old and old != user_id:
        invalidate_shelves_cache(old)
    profile.goodreads_user_id = user_id
    profile.save(update_fields=["goodreads_user_id", "updated_at"])
    invalidate_shelves_cache(user_id)

    refresh = str(request.data.get("refresh", "")).lower() in ("1", "true", "yes")
    shelves_payload = fetch_all_shelves(user_id, use_cache=not refresh)
    evaluate_reads_good_for_user(
        request.user.pk,
        shelves_payload.get("shelves"),
    )
    return Response(
        {
            "linked": True,
            "goodreads_user_id": user_id,
            "profile_url": shelves_payload["profile_url"],
            "shelves": shelves_payload["shelves"],
            "session": MeSerializer(serialize_me(request.user)).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def books_unlink(request):
    profile = get_or_create_profile(request.user)
    old = (profile.goodreads_user_id or "").strip()
    if old:
        invalidate_shelves_cache(old)
    profile.goodreads_user_id = ""
    profile.save(update_fields=["goodreads_user_id", "updated_at"])
    return Response(
        {
            "linked": False,
            "goodreads_user_id": None,
            "profile_url": None,
            "session": MeSerializer(serialize_me(request.user)).data,
        },
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def books_shelves(request):
    profile = get_or_create_profile(request.user)
    user_id = (profile.goodreads_user_id or "").strip()
    if not user_id:
        return Response(
            {
                "detail": "Link a Goodreads profile first.",
                "linked": False,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    refresh = str(request.query_params.get("refresh", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    payload = fetch_all_shelves(user_id, use_cache=not refresh)
    return Response({**payload, "linked": True})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def books_readers(request):
    """People with linked Goodreads visible under Sees me / Show me."""
    search = (request.query_params.get("q") or "").strip()
    qs = visible_books_users_qs(request.user, search=search)[:200]
    return Response({"results": [reader_row(u) for u in qs]})


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def books_community(request):
    """
    Aggregate the four community shelves for privacy-visible linked readers.

    Query params:
    - refresh: force bypass Goodreads cache
    """
    refresh = str(request.query_params.get("refresh", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    payload = community_payload(request.user, use_cache=not refresh)
    viewer_id = request.user.pk
    viewer_row = next(
        (row for row in payload.get("results") or [] if row.get("user", {}).get("id") == viewer_id),
        None,
    )
    evaluate_reads_good_for_user(
        viewer_id,
        viewer_row.get("shelves") if viewer_row else [],
    )
    return Response(payload)
