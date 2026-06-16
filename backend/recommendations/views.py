from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_204_NO_CONTENT, HTTP_403_FORBIDDEN

from recommendations.link_resolve import resolve_recommendation_link
from recommendations.achievement_hooks import (
    notify_recommendations_entry_shared,
    notify_recommendations_review_created,
)
from recommendations.models import Entry, RecommendationCategory, Review
from recommendations.serializers import (
    EntryDetailSerializer,
    EntryListSerializer,
    EntryPatchSerializer,
    EntryWriteSerializer,
    RecommendationCategoryCreateSerializer,
    RecommendationCategorySerializer,
    ReviewCreateSerializer,
    ReviewPatchSerializer,
    ReviewSerializer,
    user_row,
)
from recommendations.services import (
    active_reviews_qs,
    apply_entry_stats_prefetch,
    enrich_entry_geo_fields,
    entries_with_visible_review,
    find_merge_entry,
    geo_entries_with_visible_review,
    normalize_link,
    resolve_location_label,
    slugify_category_name,
    sort_entries_for_list,
)
from users.permissions import IsApprovedUser

User = get_user_model()


def _reviewers_for_entries(entry_ids: list[int]) -> dict[int, list]:
    if not entry_ids:
        return {}
    reviews = (
        active_reviews_qs()
        .filter(entry_id__in=entry_ids)
        .select_related("reviewer", "reviewer__profile")
        .order_by("entry_id", "-created_at")
    )
    out: dict[int, list] = {}
    for rev in reviews:
        bucket = out.setdefault(rev.entry_id, [])
        if len(bucket) < 12:
            bucket.append(user_row(rev.reviewer))
    return out


def _viewer_review_ids(viewer, entry_ids: list[int]) -> dict[int, int]:
    if not entry_ids or not viewer.is_authenticated:
        return {}
    rows = active_reviews_qs().filter(
        entry_id__in=entry_ids,
        reviewer_id=viewer.id,
    ).values("entry_id", "id")
    return {r["entry_id"]: r["id"] for r in rows}


def _serialize_entry_list(entries, *, request):
    ids = [e.id for e in entries]
    stats = apply_entry_stats_prefetch(entries)
    reviewers = _reviewers_for_entries(ids)
    viewer_reviews = _viewer_review_ids(request.user, ids)
    return EntryListSerializer(
        entries,
        many=True,
        context={
            "request": request,
            "stats": stats,
            "reviewers_by_entry": reviewers,
            "viewer_review_by_entry": viewer_reviews,
        },
    ).data


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "recommendations", "ok": True})


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def categories_list(request):
    if request.method == "POST":
        ser = RecommendationCategoryCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        name = ser.validated_data["name"]
        base_slug = slugify_category_name(name)
        slug = base_slug
        n = 2
        while RecommendationCategory.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{n}"
            n += 1
        cat = RecommendationCategory.objects.create(
            slug=slug,
            name=name,
            emoji=ser.validated_data.get("emoji") or "",
            group=ser.validated_data["group"],
            is_preset=False,
            created_by=request.user,
        )
        return Response(RecommendationCategorySerializer(cat).data, status=HTTP_201_CREATED)

    qs = RecommendationCategory.objects.all().order_by("group", "name")
    return Response(RecommendationCategorySerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def category_entries(request, category_slug: str):
    get_object_or_404(RecommendationCategory, slug=category_slug)
    qs = entries_with_visible_review(viewer=request.user, category_slug=category_slug)
    entries = list(qs)
    stats = apply_entry_stats_prefetch(entries)
    entries = sort_entries_for_list(entries, stats)
    return Response(_serialize_entry_list(entries, request=request))


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def group_entries(request, group: str):
    from recommendations.constants import CategoryGroup

    if group not in CategoryGroup.values:
        return Response({"detail": "Unknown group."}, status=404)
    qs = entries_with_visible_review(viewer=request.user, group=group)
    entries = list(qs)
    stats = apply_entry_stats_prefetch(entries)
    entries = sort_entries_for_list(entries, stats)
    return Response(_serialize_entry_list(entries, request=request))


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def entries_geo(request):
    qs = geo_entries_with_visible_review(viewer=request.user)
    entries = list(qs)
    return Response(_serialize_entry_list(entries, request=request))


@api_view(["GET", "PATCH"])
@permission_classes([IsApprovedUser])
def entry_detail(request, entry_id: int):
    entry = get_object_or_404(
        Entry.objects.select_related("category", "created_by", "created_by__profile"),
        pk=entry_id,
    )

    if request.method == "PATCH":
        if entry.created_by_id != request.user.id:
            return Response({"detail": "Only the entry creator may edit metadata."}, status=403)
        ser = EntryPatchSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if "link" in data:
            entry.link = data.get("link") or ""
            entry.link_normalized = normalize_link(entry.link)
        for field in (
            "title",
            "image_url",
            "creator",
            "media_source",
            "address",
            "google_place_id",
            "latitude",
            "longitude",
        ):
            if field in data:
                setattr(entry, field, data[field] if data[field] is not None else "")
        if "location_label" in data:
            entry.location_label = data["location_label"] or ""
        elif any(f in data for f in ("address", "latitude", "longitude")):
            entry.location_label = resolve_location_label(
                address=entry.address,
                latitude=entry.latitude,
                longitude=entry.longitude,
                link=entry.link,
                title=entry.title,
            )
        entry.save()
        entry.refresh_from_db()

    reviews = list(
        active_reviews_qs()
        .filter(entry=entry)
        .select_related("reviewer", "reviewer__profile")
        .order_by("-date_recommended", "-created_at")
    )
    stats = apply_entry_stats_prefetch([entry])
    reviewers = _reviewers_for_entries([entry.id])
    viewer_reviews = _viewer_review_ids(request.user, [entry.id])
    payload = EntryDetailSerializer(
        entry,
        context={
            "request": request,
            "stats": stats,
            "reviewers_by_entry": reviewers,
            "viewer_review_by_entry": viewer_reviews,
            "reviews": reviews,
        },
    ).data
    return Response(payload)


def _serialize_reviews_with_entries(reviews, *, request) -> list[dict]:
    if not reviews:
        return []
    entry_ids = [rev.entry_id for rev in reviews]
    entries = [rev.entry for rev in reviews]
    stats = apply_entry_stats_prefetch(entries)
    reviewers = _reviewers_for_entries(entry_ids)
    viewer_reviews = _viewer_review_ids(request.user, entry_ids)
    out = []
    for rev in reviews:
        row = ReviewSerializer(rev).data
        row["entry"] = EntryListSerializer(
            rev.entry,
            context={
                "request": request,
                "stats": stats,
                "reviewers_by_entry": reviewers,
                "viewer_review_by_entry": viewer_reviews,
            },
        ).data
        out.append(row)
    return out


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def reviews_mine(request):
    qs = (
        active_reviews_qs()
        .filter(reviewer=request.user)
        .select_related("entry", "entry__category", "reviewer", "reviewer__profile")
        .order_by("-updated_at")
    )
    return Response(_serialize_reviews_with_entries(list(qs), request=request))


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def reviews_friend_owner(request, owner_user_id: int):
    from friends.services import are_friends

    user = request.user
    if user.id == owner_user_id:
        return Response(
            {"detail": "Use /api/v1/recommendations/reviews/mine/ for your own reviews."},
            status=400,
        )
    owner = User.objects.filter(pk=owner_user_id).first()
    if owner is None:
        return Response({"detail": "Not found."}, status=404)
    if not are_friends(user_a=user, user_b=owner):
        return Response(
            {"detail": "You can only browse recommendations shared by approved friends."},
            status=HTTP_403_FORBIDDEN,
        )
    qs = (
        active_reviews_qs()
        .filter(reviewer_id=owner_user_id)
        .select_related("entry", "entry__category", "reviewer", "reviewer__profile")
        .order_by("-updated_at")
    )
    return Response(_serialize_reviews_with_entries(list(qs), request=request))


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def entry_create(request):
    ser = EntryWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    category = get_object_or_404(RecommendationCategory, slug=data["category_slug"])
    link = (data.get("link") or "").strip()
    place_id = (data.get("google_place_id") or "").strip()
    address = (data.get("address") or "").strip()
    latitude, longitude, place_id = enrich_entry_geo_fields(
        address=address,
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        google_place_id=place_id,
    )

    existing = find_merge_entry(link=link, google_place_id=place_id)
    merged = existing is not None

    if merged:
        entry = existing
    else:
        entry = Entry.objects.create(
            category=category,
            title=data["title"],
            link=link,
            link_normalized=normalize_link(link),
            image_url=(data.get("image_url") or "").strip(),
            creator=(data.get("creator") or "").strip(),
            media_source=(data.get("media_source") or "").strip(),
            address=address,
            location_label=resolve_location_label(
                address=address,
                latitude=latitude,
                longitude=longitude,
                link=link,
                title=data["title"],
            ),
            google_place_id=place_id,
            latitude=latitude,
            longitude=longitude,
            created_by=request.user,
        )

    existing_review = (
        active_reviews_qs().filter(entry=entry, reviewer=request.user).first()
        if merged
        else None
    )
    if existing_review:
        patch_ser = ReviewPatchSerializer(data={"rating": data["rating"], "body": data["body"]})
        patch_ser.is_valid(raise_exception=True)
        existing_review.rating = patch_ser.validated_data.get("rating", existing_review.rating)
        if patch_ser.validated_data.get("body") is not None:
            existing_review.body = patch_ser.validated_data["body"]
        existing_review.edited_at = timezone.now()
        if data.get("date_recommended"):
            existing_review.date_recommended = data["date_recommended"]
        existing_review.save()
        review = existing_review
    else:
        review = Review.objects.create(
            entry=entry,
            reviewer=request.user,
            rating=data["rating"],
            body=data["body"],
            date_recommended=data.get("date_recommended") or timezone.localdate(),
        )
        notify_recommendations_entry_shared(
            user_id=request.user.id,
            entry_creator_id=entry.created_by_id,
        )

    stats = apply_entry_stats_prefetch([entry])
    reviewers = _reviewers_for_entries([entry.id])
    viewer_reviews = _viewer_review_ids(request.user, [entry.id])
    entry_payload = EntryDetailSerializer(
        entry,
        context={
            "request": request,
            "stats": stats,
            "reviewers_by_entry": reviewers,
            "viewer_review_by_entry": viewer_reviews,
            "reviews": list(
                active_reviews_qs()
                .filter(entry=entry)
                .select_related("reviewer", "reviewer__profile")
                .order_by("-date_recommended", "-created_at")
            ),
        },
    ).data

    body = {
        "merged": merged,
        "entry": entry_payload,
        "review": ReviewSerializer(review).data,
    }
    if merged:
        body["message"] = "An entry already exists."
        return Response(body, status=HTTP_200_OK)
    return Response(body, status=HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
@transaction.atomic
def entry_review_create(request, entry_id: int):
    entry = get_object_or_404(Entry, pk=entry_id)
    if active_reviews_qs().filter(entry=entry, reviewer=request.user).exists():
        return Response({"detail": "You already reviewed this entry."}, status=400)
    ser = ReviewCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    review = Review.objects.create(
        entry=entry,
        reviewer=request.user,
        rating=data["rating"],
        body=data["body"],
        date_recommended=data.get("date_recommended") or timezone.localdate(),
    )
    notify_recommendations_review_created(
        user_id=request.user.id,
        entry_creator_id=entry.created_by_id,
    )
    return Response(ReviewSerializer(review).data, status=HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsApprovedUser])
def review_detail(request, review_id: int):
    review = get_object_or_404(
        active_reviews_qs().select_related("entry"),
        pk=review_id,
        reviewer=request.user,
    )

    if request.method == "DELETE":
        review.deleted_at = timezone.now()
        review.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=HTTP_204_NO_CONTENT)

    ser = ReviewPatchSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    changed = False
    if "rating" in data:
        review.rating = data["rating"]
        changed = True
    if "body" in data and data["body"] is not None:
        body = data["body"].strip()
        if body:
            review.body = body
            changed = True
    if changed:
        review.edited_at = timezone.now()
    review.save()
    return Response(ReviewSerializer(review).data)


@api_view(["POST"])
@permission_classes([IsApprovedUser])
def resolve_link(request):
    url = request.data.get("url") or ""
    return Response(resolve_recommendation_link(str(url)))
