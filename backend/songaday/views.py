import re
from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED

from achievements.services import (
    evaluate_songaday_month_of_music_for_user,
    evaluate_songaday_music_lover_for_user,
)
from friends.services import friend_ids_for_user
from songaday.access import can_view_song_response, visible_song_responses_q
from songaday.models import SongPrompt, SongResponse, SongResponseHeart
from users.models import Profile
from songaday.resolve_link import ResolveError, resolve_from_youtube_video_id, resolve_song_link_metadata
from songaday.serializers import (
    SongResponseCreateSerializer,
    SongResponsePatchSerializer,
    SongResponseReadSerializer,
)
from users.permissions import IsApprovedUser, IsStaffUser

User = get_user_model()

MAX_BULK_IMPORT_CHARS = 500_000
_MAX_BULK_LINES = 400


def _parse_ymd(request):
    try:
        y = int(request.query_params.get("year", ""))
        m = int(request.query_params.get("month", ""))
        d = int(request.query_params.get("day", ""))
    except (TypeError, ValueError):
        return None, Response({"detail": "year, month, and day query params are required integers."}, status=400)
    try:
        return date(y, m, d), None
    except ValueError:
        return None, Response({"detail": "Invalid calendar date."}, status=400)


def _visible_responses_qs(*, viewer, entry: date):
    friend_ids = friend_ids_for_user(user=viewer)
    q_vis = visible_song_responses_q(viewer=viewer, friend_ids=friend_ids)
    return SongResponse.objects.filter(entry_date=entry).filter(q_vis)


def _annotate_hearts(qs, viewer_id: int):
    heart_sub = SongResponseHeart.objects.filter(
        response_id=OuterRef("pk"),
        user_id=viewer_id,
    )
    return qs.annotate(
        heart_count=Count("hearts", distinct=True),
        viewer_has_hearted=Exists(heart_sub),
        comment_count=Count("comments", distinct=True),
    )


def _can_view_response(*, viewer, response: SongResponse) -> bool:
    return can_view_song_response(viewer=viewer, response=response)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def prompt_for_date(request):
    parsed, err = _parse_ymd(request)
    if err:
        return err
    entry = parsed
    prompt = SongPrompt.objects.filter(month=entry.month, day=entry.day).first()
    if prompt is None:
        return Response(
            {
                "prompt": None,
                "month": entry.month,
                "day": entry.day,
            }
        )
    return Response(
        {
            "id": prompt.id,
            "prompt": prompt.prompt,
            "month": entry.month,
            "day": entry.day,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def responses_archive(request):
    """
    List a user's song submissions newest-first (optional ?user_id= for a friend).
    """
    raw = request.query_params.get("user_id")
    viewer = request.user
    if raw is None or raw == "":
        target_id = viewer.id
    else:
        try:
            tid = int(raw)
        except (TypeError, ValueError):
            return Response({"detail": "user_id must be an integer."}, status=400)
        if tid == viewer.id:
            target_id = tid
        elif tid not in friend_ids_for_user(user=viewer):
            return Response({"detail": "Not found."}, status=404)
        else:
            get_object_or_404(User, pk=tid)
            target_id = tid

    try:
        page = max(1, int(request.query_params.get("page", "1")))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(50, max(1, int(request.query_params.get("page_size", "10"))))
    except (TypeError, ValueError):
        page_size = 10

    if target_id != viewer.id:
        owner = get_object_or_404(User.objects.select_related("profile"), pk=target_id)
        prof = getattr(owner, "profile", None)
        if prof and prof.songaday_visibility == Profile.SongadayVisibility.PRIVATE:
            base = SongResponse.objects.none()
        else:
            base = SongResponse.objects.filter(user_id=target_id).order_by("-entry_date", "-id")
    else:
        base = SongResponse.objects.filter(user_id=target_id).order_by("-entry_date", "-id")
    qs = _annotate_hearts(base, viewer.id).select_related("user", "user__profile", "prompt")
    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    rows = list(qs[start:end])
    data = SongResponseReadSerializer(rows, many=True).data
    return Response(
        {
            "results": data,
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_next": end < total,
            "has_prev": page > 1,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def responses_archive_eligible_friends(request):
    """
    Friend user IDs who have at least one Song a Day submission (for archive picker).
    """
    viewer = request.user
    fids = friend_ids_for_user(user=viewer)
    if not fids:
        return Response({"user_ids": []})
    with_sub = (
        SongResponse.objects.filter(user_id__in=fids)
        .values_list("user_id", flat=True)
        .distinct()
    )
    return Response({"user_ids": sorted(set(with_sub))})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def responses_for_date(request):
    parsed, err = _parse_ymd(request)
    if err:
        return err
    entry = parsed
    qs = _visible_responses_qs(viewer=request.user, entry=entry)
    qs = _annotate_hearts(qs, request.user.id).select_related("user", "user__profile", "prompt")
    data = SongResponseReadSerializer(qs, many=True).data
    return Response(data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def response_detail(request, response_id: int):
    response = get_object_or_404(
        SongResponse.objects.select_related("user", "user__profile", "prompt"),
        pk=response_id,
    )
    if not _can_view_response(viewer=request.user, response=response):
        return Response({"detail": "Not found."}, status=404)

    if request.method == "GET":
        qs = SongResponse.objects.filter(pk=response_id)
        qs = _annotate_hearts(qs, request.user.id)
        obj = qs.select_related("user", "user__profile", "prompt").get()
        return Response(SongResponseReadSerializer(obj).data)

    if request.method == "DELETE":
        if response.user_id != request.user.id:
            return Response({"detail": "Forbidden."}, status=403)
        uid = request.user.id
        response.delete()
        evaluate_songaday_month_of_music_for_user(uid)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    if response.user_id != request.user.id:
        return Response({"detail": "Forbidden."}, status=403)
    ser = SongResponsePatchSerializer(response, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    qs = SongResponse.objects.filter(pk=response_id)
    qs = _annotate_hearts(qs, request.user.id)
    obj = qs.select_related("user", "user__profile", "prompt").get()
    return Response(SongResponseReadSerializer(obj).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def response_create(request):
    ser = SongResponseCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    entry: date = data["entry_date"]
    prompt = SongPrompt.objects.filter(month=entry.month, day=entry.day).first()
    if prompt is None:
        return Response({"detail": "There is no prompt for this date."}, status=400)

    if SongResponse.objects.filter(user_id=request.user.id, entry_date=entry).exists():
        return Response({"detail": "You already submitted for this date."}, status=409)

    row = SongResponse.objects.create(
        user=request.user,
        prompt=prompt,
        entry_date=entry,
        prompt_snapshot=data["prompt_snapshot"].strip(),
        notes=(data.get("notes") or "").strip(),
        artist=(data.get("artist") or "").strip(),
        title=(data.get("title") or "").strip(),
        raw_label=(data.get("raw_label") or "").strip(),
        youtube_video_id=(data.get("youtube_video_id") or "").strip(),
        spotify_url=(data.get("spotify_url") or "").strip(),
        apple_music_url=(data.get("apple_music_url") or "").strip(),
    )
    evaluate_songaday_month_of_music_for_user(request.user.id)
    qs = SongResponse.objects.filter(pk=row.pk)
    qs = _annotate_hearts(qs, request.user.id)
    obj = qs.select_related("user", "user__profile", "prompt").get()
    return Response(SongResponseReadSerializer(obj).data, status=HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def response_heart_toggle(request, response_id: int):
    target = get_object_or_404(SongResponse, pk=response_id)
    if target.user_id == request.user.id:
        return Response({"detail": "You cannot heart your own submission."}, status=400)
    if not _can_view_response(viewer=request.user, response=target):
        return Response({"detail": "Not found."}, status=404)

    heart, created = SongResponseHeart.objects.get_or_create(
        response=target,
        user=request.user,
    )
    if not created:
        heart.delete()
        viewer_has = False
    else:
        viewer_has = True

    count = SongResponseHeart.objects.filter(response_id=target.id).count()
    evaluate_songaday_music_lover_for_user(request.user.id)
    return Response({"heart_count": count, "viewer_has_hearted": viewer_has})


_BULK_LINE_RE = re.compile(r"^\s*(\d{1,2})\s+(\d{1,2})\s+(.+?)\s*$")


def _parse_bulk_prompt_lines(text: str) -> list[tuple[int, int, str]] | None:
    lines = [ln for ln in (text or "").splitlines() if ln.strip()]
    out: list[tuple[int, int, str]] = []
    for ln in lines:
        m = _BULK_LINE_RE.match(ln)
        if not m:
            return None
        month, day, prompt = int(m.group(1)), int(m.group(2)), m.group(3).strip()
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return None
        try:
            date(2024, month, day)
        except ValueError:
            return None
        if not prompt:
            return None
        out.append((month, day, prompt))
    return out


@api_view(["GET"])
@permission_classes([IsStaffUser])
def prompts_list(request):
    """Staff-only: all calendar prompts ordered by (month, day)."""
    rows = list(SongPrompt.objects.order_by("month", "day").values("month", "day", "prompt"))
    return Response({"results": rows})


@api_view(["POST"])
@permission_classes([IsStaffUser])
@transaction.atomic
def prompts_bulk_import(request):
    raw = request.data.get("text")
    if raw is None:
        return Response({"detail": "`text` is required."}, status=400)
    text = str(raw)
    if len(text) > MAX_BULK_IMPORT_CHARS:
        return Response({"detail": "Bulk import text is too large."}, status=400)
    parsed = _parse_bulk_prompt_lines(text)
    if parsed is None:
        return Response(
            {
                "detail": 'Each non-empty line must look like: "MM DD Prompt text…" with valid month/day.',
            },
            status=400,
        )
    if len(parsed) > _MAX_BULK_LINES:
        return Response({"detail": "Too many lines in one import."}, status=400)

    created = 0
    updated = 0
    for month, day, prompt_text in parsed:
        _obj, was_created = SongPrompt.objects.update_or_create(
            month=month,
            day=day,
            defaults={"prompt": prompt_text},
        )
        if was_created:
            created += 1
        else:
            updated += 1

    return Response({"created_count": created, "updated_count": updated, "total": len(parsed)})


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"ok": True})


def _resolve_error_status(message: str) -> int:
    m = message.lower()
    if any(
        x in m
        for x in (
            "not allowed",
            "empty url",
            "invalid url",
            "unsupported",
            "invalid youtube",
            "empty youtube",
        )
    ):
        return status.HTTP_400_BAD_REQUEST
    return status.HTTP_502_BAD_GATEWAY


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resolve_song_link(request):
    """
    Resolve artist/title from YouTube, Spotify, or Apple Music via oEmbed / page metadata.
    Body: { "url": "https://..." } and/or { "youtube_video_id": "..." } (video id alone is enough).
    """
    url = (request.data.get("url") or "").strip()
    yt_id = (request.data.get("youtube_video_id") or "").strip()
    try:
        if url:
            artist, title, src = resolve_song_link_metadata(url)
        elif yt_id:
            artist, title, src = resolve_from_youtube_video_id(yt_id)
        else:
            return Response({"detail": "Provide `url` or `youtube_video_id`."}, status=400)
    except ResolveError as e:
        msg = str(e)
        return Response({"detail": msg}, status=_resolve_error_status(msg))
    return Response({"artist": artist, "title": title, "source": src})
