import operator
import re
from collections import defaultdict
from datetime import date, timedelta
from functools import reduce

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
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
from users.social_privacy import viewer_context
from songaday.resolve_link import ResolveError, resolve_from_youtube_video_id, resolve_song_link_metadata
from songaday.serializers import (
    SongResponseCreateSerializer,
    SongResponsePatchSerializer,
    SongResponseReadSerializer,
)
from songaday.submission import (
    SongadaySubmissionError,
    create_song_response_from_validated_data,
    validate_song_response_payload,
)
from users.permissions import IsApprovedUser, IsStaffUser

User = get_user_model()

MAX_BULK_IMPORT_CHARS = 500_000
_MAX_BULK_LINES = 400
# Max inclusive span for GET day-window (matches frontend prefetch guardrails).
DAY_WINDOW_MAX_SPAN_DAYS = 31


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
    qs = SongResponse.objects.filter(entry_date=entry).filter(q_vis)

    # Apply viewer read preference as a soft filter on the day list.
    ctx = viewer_context(viewer=viewer)
    scope = getattr(getattr(viewer, "profile", None), "social_read_scope", None) or Profile.SocialReadScope.APPROVED_USERS
    if ctx.is_approved and scope == Profile.SocialReadScope.FRIENDS_ONLY:
        allowed = set(ctx.friend_ids)
        allowed.add(ctx.viewer_id)
        qs = qs.filter(user_id__in=list(allowed))
    return qs


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


def _parse_iso_date_param(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw.strip())
    except ValueError:
        return None


def _visible_responses_qs_range(*, viewer, start: date, end: date):
    friend_ids = friend_ids_for_user(user=viewer)
    q_vis = visible_song_responses_q(viewer=viewer, friend_ids=friend_ids)
    qs = SongResponse.objects.filter(entry_date__gte=start, entry_date__lte=end).filter(q_vis)

    ctx = viewer_context(viewer=viewer)
    scope = getattr(getattr(viewer, "profile", None), "social_read_scope", None) or Profile.SocialReadScope.APPROVED_USERS
    if ctx.is_approved and scope == Profile.SocialReadScope.FRIENDS_ONLY:
        allowed = set(ctx.friend_ids)
        allowed.add(ctx.viewer_id)
        qs = qs.filter(user_id__in=list(allowed))
    return qs


def _archive_seed_payload(*, viewer, page: int = 1, page_size: int = 50) -> dict:
    """Same JSON shape as GET responses_archive for the viewer's own archive."""
    base = SongResponse.objects.filter(user_id=viewer.id).order_by("-entry_date", "-id")
    qs = _annotate_hearts(base, viewer.id).select_related("user", "user__profile", "prompt")
    total = qs.count()
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    rows = list(qs[start_idx:end_idx])
    data = SongResponseReadSerializer(rows, many=True).data
    return {
        "results": data,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_next": end_idx < total,
        "has_prev": page > 1,
    }


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
def day_window(request):
    """
    Prompts + responses per ISO date for [start_date, end_date], plus first archive page.
    Matches separate calls to prompts/for-date, responses/for-date (per day), and archive page 1.
    """
    start_d = _parse_iso_date_param(request.query_params.get("start_date"))
    end_d = _parse_iso_date_param(request.query_params.get("end_date"))
    if start_d is None or end_d is None:
        return Response(
            {"detail": "start_date and end_date query params (YYYY-MM-DD) are required."},
            status=400,
        )
    if end_d < start_d:
        return Response({"detail": "end_date must be on or after start_date."}, status=400)
    if (end_d - start_d).days > DAY_WINDOW_MAX_SPAN_DAYS:
        return Response(
            {"detail": f"Range cannot exceed {DAY_WINDOW_MAX_SPAN_DAYS} days."},
            status=400,
        )

    viewer = request.user
    dates: list[date] = []
    cur = start_d
    while cur <= end_d:
        dates.append(cur)
        cur += timedelta(days=1)

    pairs = {(dt.month, dt.day) for dt in dates}
    prompt_by_pair: dict[tuple[int, int], SongPrompt] = {}
    if pairs:
        q_or = reduce(operator.or_, (Q(month=m, day=dy) for m, dy in pairs))
        prompt_by_pair = {(p.month, p.day): p for p in SongPrompt.objects.filter(q_or)}

    prompts_out: dict[str, dict] = {}
    for dt in dates:
        iso = dt.isoformat()
        pr = prompt_by_pair.get((dt.month, dt.day))
        if pr is None:
            prompts_out[iso] = {"prompt": None, "month": dt.month, "day": dt.day}
        else:
            prompts_out[iso] = {
                "id": pr.id,
                "prompt": pr.prompt,
                "month": dt.month,
                "day": dt.day,
            }

    qs = _visible_responses_qs_range(viewer=viewer, start=start_d, end=end_d)
    qs = _annotate_hearts(qs, viewer.id).select_related("user", "user__profile", "prompt")
    rows = list(qs.order_by("entry_date", "-created_at"))
    by_iso: dict[str, list] = defaultdict(list)
    for row in rows:
        by_iso[row.entry_date.isoformat()].append(row)

    responses_out: dict[str, list] = {}
    for dt in dates:
        iso = dt.isoformat()
        lst = by_iso.get(iso, [])
        responses_out[iso] = SongResponseReadSerializer(lst, many=True).data

    archive_seed = _archive_seed_payload(viewer=viewer, page=1, page_size=50)

    return Response(
        {
            "prompts": prompts_out,
            "responses": responses_out,
            "archive_seed": archive_seed,
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
        else:
            owner = get_object_or_404(User.objects.select_related("profile"), pk=tid)
            prof = getattr(owner, "profile", None)
            publish_vis = (
                getattr(prof, "social_publish_visibility", None)
                or Profile.SocialPublishVisibility.ALL_APPROVED
            )
            if publish_vis == Profile.SocialPublishVisibility.FRIENDS_ONLY and tid not in friend_ids_for_user(
                user=viewer
            ):
                return Response({"detail": "Not found."}, status=404)
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
def response_create(request):
    try:
        data = validate_song_response_payload(request.data)
        row = create_song_response_from_validated_data(user=request.user, data=data)
    except SongadaySubmissionError as e:
        return Response({"detail": e.message}, status=e.status_code)
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
