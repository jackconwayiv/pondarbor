from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Max, Q, QuerySet

from recommendations.constants import LOCATION_LABEL_SORT_ORDER
from recommendations.models import Entry, Review
from users.models import Profile
from users.social_privacy import viewer_context

User = get_user_model()

_TRACKING_QUERY_KEYS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
    }
)


def normalize_link(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
    except Exception:
        return raw.lower().rstrip("/")
    scheme = (parsed.scheme or "https").lower()
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/") or ""
    query_pairs = parse_qs(parsed.query, keep_blank_values=False)
    filtered = [
        (k, v[0])
        for k, v in sorted(query_pairs.items())
        if k.lower() not in _TRACKING_QUERY_KEYS and v
    ]
    query = urlencode(filtered) if filtered else ""
    return urlunparse((scheme, host, path, "", query, "")).lower()


_COORD_QUANT = Decimal("0.000001")


def normalize_coordinate(value, *, kind: str) -> Decimal | None:
    """Round lat/lng to 6 decimal places for Entry DecimalField(max_digits=9, decimal_places=6)."""
    if value is None or value == "":
        return None
    try:
        dec = Decimal(str(value)).quantize(_COORD_QUANT, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as e:
        raise ValueError(f"Invalid {kind}.") from e
    limit = Decimal("180") if kind == "longitude" else Decimal("90")
    if dec.copy_abs() > limit:
        raise ValueError(f"{kind} out of range.")
    return dec


def normalize_rating(value) -> Decimal:
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, TypeError) as e:
        raise ValueError("Invalid rating.") from e
    if dec < Decimal("1") or dec > Decimal("5"):
        raise ValueError("Rating must be between 1 and 5.")
    as_str = format(dec.normalize(), "f")
    if "." in as_str:
        trimmed = as_str.rstrip("0").rstrip(".")
    else:
        trimmed = as_str
    sig_len = len(trimmed.replace(".", "").lstrip("-"))
    if sig_len > 3:
        raise ValueError("Rating must use at most 3 significant figures.")
    return dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def format_rating_display(value: Decimal | None) -> str | None:
    if value is None:
        return None
    f = float(value)
    return format(f, ".3g")


def viewer_visible_reviewer_ids(*, viewer) -> set[int] | None:
    """Reviewer ids whose reviews count toward surfacing entries for this viewer."""
    ctx = viewer_context(viewer=viewer)
    if not ctx.is_approved:
        return {ctx.viewer_id} if ctx.viewer_id else set()
    profile = getattr(viewer, "profile", None)
    scope = (
        profile.social_read_scope
        if profile
        else Profile.SocialReadScope.APPROVED_USERS
    )
    if scope == Profile.SocialReadScope.FRIENDS_ONLY:
        allowed = set(ctx.friend_ids)
        allowed.add(ctx.viewer_id)
        return allowed
    return None  # all approved reviewers


def active_reviews_qs() -> QuerySet:
    return Review.objects.filter(deleted_at__isnull=True)


def entries_with_visible_review(
    *,
    viewer,
    category_slug: str | None = None,
    group: str | None = None,
) -> QuerySet:
    """Entries that have at least one review from a reviewer the viewer can see."""
    reviewer_ids = viewer_visible_reviewer_ids(viewer=viewer)
    review_filter = Q(reviews__deleted_at__isnull=True)
    if reviewer_ids is not None:
        review_filter &= Q(reviews__reviewer_id__in=list(reviewer_ids))

    qs = (
        Entry.objects.filter(review_filter)
        .distinct()
        .select_related("category", "created_by", "created_by__profile")
    )
    if category_slug:
        qs = qs.filter(category__slug=category_slug)
    if group:
        qs = qs.filter(category__group=group)
    return qs


def geo_entries_with_visible_review(*, viewer) -> QuerySet:
    qs = entries_with_visible_review(viewer=viewer)
    return qs.filter(
        latitude__isnull=False,
        longitude__isnull=False,
    ).exclude(latitude=0, longitude=0)


def find_merge_entry(*, link: str = "", google_place_id: str = "") -> Entry | None:
    norm = normalize_link(link)
    if norm:
        existing = Entry.objects.filter(link_normalized=norm).first()
        if existing:
            return existing
    pid = (google_place_id or "").strip()
    if pid:
        return Entry.objects.filter(google_place_id=pid).first()
    return None


def location_sort_key(label: str) -> tuple:
    key = (label or "").strip().lower()
    if not key:
        return (999, "")
    order = LOCATION_LABEL_SORT_ORDER.get(key, 100)
    return (order, key)


def resolve_location_label(
    *,
    address: str = "",
    latitude=None,
    longitude=None,
    link: str = "",
    title: str = "",
) -> str:
    """Infer metro label (phoenix, scottsdale, …) from address text or coordinates."""
    from recommendations.geocode import reverse_geocode_coords
    from recommendations.link_resolve import _infer_location_label

    label = _infer_location_label(link, title, address)
    if label:
        return label
    if latitude is not None and longitude is not None:
        geocoded = reverse_geocode_coords(latitude, longitude)
        if geocoded:
            formatted = geocoded.get("formatted_address") or ""
            label = _infer_location_label(formatted, title, formatted)
            if label:
                return label
    return ""


def sort_entries_for_list(entries: list[Entry], review_stats: dict[int, dict]) -> list[Entry]:
    """Location-labeled first (Phoenix metro order), then by last_reviewed_at desc."""

    def last_at(entry_id: int):
        stats = review_stats.get(entry_id) or {}
        return stats.get("last_reviewed_at") or datetime.min.replace(tzinfo=dt_timezone.utc)

    with_loc = [e for e in entries if (e.location_label or "").strip()]
    without_loc = [e for e in entries if not (e.location_label or "").strip()]
    with_loc.sort(key=lambda e: (location_sort_key(e.location_label), e.title.lower()))
    without_loc.sort(key=lambda e: last_at(e.id), reverse=True)
    return with_loc + without_loc


def annotate_entry_stats(qs: QuerySet, *, viewer_id: int | None = None) -> list[dict]:
    """Return list of stat dicts keyed by entry id for aggregation."""
    entry_ids = list(qs.values_list("id", flat=True))
    if not entry_ids:
        return {}

    stats = (
        active_reviews_qs()
        .filter(entry_id__in=entry_ids)
        .values("entry_id")
        .annotate(
            review_count=Count("id"),
            average_rating=Avg("rating"),
            last_reviewed_at=Max("updated_at"),
        )
    )
    return {row["entry_id"]: row for row in stats}


def apply_entry_stats_prefetch(entries: list[Entry]) -> dict[int, dict]:
    ids = [e.id for e in entries]
    if not ids:
        return {}
    rows = (
        active_reviews_qs()
        .filter(entry_id__in=ids)
        .values("entry_id")
        .annotate(
            review_count=Count("id"),
            average_rating=Avg("rating"),
            last_reviewed_at=Max("updated_at"),
        )
    )
    return {r["entry_id"]: r for r in rows}


def slugify_category_name(name: str) -> str:
    raw = (name or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return slug[:64] or "category"


def enrich_entry_geo_fields(
    *,
    address: str = "",
    latitude=None,
    longitude=None,
    google_place_id: str = "",
) -> tuple:
    """Fill missing lat/lng (and place_id) from a geocoded address when possible."""
    from recommendations.geocode import _google_geocode

    lat, lng = latitude, longitude
    place_id = (google_place_id or "").strip()
    if lat is not None and lng is not None:
        return lat, lng, place_id

    addr = (address or "").strip()
    if not addr:
        return lat, lng, place_id

    geocoded = _google_geocode(addr)
    if not geocoded:
        return lat, lng, place_id

    try:
        lat = normalize_coordinate(geocoded["lat"], kind="latitude")
        lng = normalize_coordinate(geocoded["lng"], kind="longitude")
    except ValueError:
        return latitude, longitude, place_id

    if not place_id:
        place_id = (geocoded.get("place_id") or "").strip()
    return lat, lng, place_id
