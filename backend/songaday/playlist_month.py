"""Browse and month-grid playlist views (in-house embeds; no Spotify API)."""

from __future__ import annotations

import calendar
from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import ExtractMonth, ExtractYear
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from friends.services import friend_ids_for_user
from songaday.access import visible_song_responses_q
from songaday.models import SongResponse
from songaday.serializers import SongResponseReadSerializer, user_row_for_songaday
from songaday.views import _annotate_hearts
from users.models import Profile
from users.social_privacy import viewer_context

User = get_user_model()


def _resolve_target_user_id(request, *, required: bool = False) -> tuple[int | None, Response | None]:
    """Same user_id rules as responses_archive."""
    raw = request.query_params.get("user_id")
    viewer = request.user
    if raw is None or raw == "":
        if required:
            return None, Response({"detail": "user_id is required."}, status=400)
        return viewer.id, None
    try:
        tid = int(raw)
    except (TypeError, ValueError):
        return None, Response({"detail": "user_id must be an integer."}, status=400)
    if tid == viewer.id:
        return tid, None
    owner = get_object_or_404(User.objects.select_related("profile"), pk=tid)
    prof = getattr(owner, "profile", None)
    publish_vis = (
        getattr(prof, "social_publish_visibility", None)
        or Profile.SocialPublishVisibility.ALL_APPROVED
    )
    if publish_vis == Profile.SocialPublishVisibility.FRIENDS_ONLY and tid not in friend_ids_for_user(
        user=viewer
    ):
        return None, Response({"detail": "Not found."}, status=404)
    return tid, None


def _parse_year_month(request) -> tuple[int, int, Response | None]:
    try:
        year = int(request.query_params.get("year", ""))
        month = int(request.query_params.get("month", ""))
    except (TypeError, ValueError):
        return 0, 0, Response({"detail": "year and month query params are required integers."}, status=400)
    if not (1 <= month <= 12):
        return 0, 0, Response({"detail": "month must be between 1 and 12."}, status=400)
    if year < 1 or year > 9999:
        return 0, 0, Response({"detail": "Invalid year."}, status=400)
    return year, month, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def playlists_browse(request):
    """
    Distinct (user, year, month) buckets the viewer may see with at least one submission.
    """
    viewer = request.user
    friend_ids = friend_ids_for_user(user=viewer)
    ctx = viewer_context(viewer=viewer)
    q_vis = visible_song_responses_q(viewer=viewer, friend_ids=friend_ids, ctx=ctx)

    groups = (
        SongResponse.objects.filter(q_vis)
        .annotate(
            year=ExtractYear("entry_date"),
            month=ExtractMonth("entry_date"),
        )
        .values("user_id", "year", "month")
        .annotate(submission_count=Count("id"))
        .order_by("-year", "-month", "user_id")
    )
    group_list = list(groups)
    if not group_list:
        return Response({"results": []})

    user_ids = {g["user_id"] for g in group_list}
    users_by_id = {
        u.id: user_row_for_songaday(u)
        for u in User.objects.filter(pk__in=user_ids).select_related("profile")
    }

    results = []
    for g in group_list:
        uid = g["user_id"]
        row = users_by_id.get(uid)
        display_name = (row or {}).get("nickname") or f"User {uid}"
        results.append(
            {
                "user_id": uid,
                "display_name": display_name,
                "avatar_url": (row or {}).get("avatar_url") or "",
                "year": int(g["year"]),
                "month": int(g["month"]),
                "submission_count": int(g["submission_count"]),
            }
        )

    return Response({"results": results})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def playlists_month(request):
    """All submissions for one user's calendar month, ascending by entry_date."""
    target_id, err = _resolve_target_user_id(request, required=False)
    if err is not None:
        return err
    assert target_id is not None

    year, month, err = _parse_year_month(request)
    if err is not None:
        return err

    viewer = request.user
    last_day = calendar.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last_day)

    owner = get_object_or_404(User.objects.select_related("profile"), pk=target_id)
    prof = getattr(owner, "profile", None)
    if target_id != viewer.id and prof and prof.songaday_visibility == Profile.SongadayVisibility.PRIVATE:
        return Response({"detail": "Not found."}, status=404)

    friend_ids = friend_ids_for_user(user=viewer)
    ctx = viewer_context(viewer=viewer)
    q_vis = visible_song_responses_q(viewer=viewer, friend_ids=friend_ids, ctx=ctx)
    base = SongResponse.objects.filter(user_id=target_id).filter(q_vis)

    qs = (
        _annotate_hearts(
            base.filter(entry_date__gte=start, entry_date__lte=end),
            viewer.id,
        )
        .select_related("user", "user__profile", "prompt")
        .order_by("entry_date", "id")
    )
    rows = list(qs)
    owner = rows[0].user if rows else owner

    return Response(
        {
            "user": user_row_for_songaday(owner),
            "year": year,
            "month": month,
            "results": SongResponseReadSerializer(rows, many=True).data,
        }
    )
