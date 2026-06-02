"""Shared pantry access for mutual meal partners."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from meal.models import UserIngredientInventory
from meal.partner import meal_partner_user_ids
from meal.pantry_tags import normalize_pantry_tags

User = get_user_model()


def pantry_owner_user_ids(*, user) -> set[int]:
    return meal_partner_user_ids(user=user)


def pantry_inventory_queryset(*, user):
    ids = pantry_owner_user_ids(user=user)
    return UserIngredientInventory.objects.filter(owner_user_id__in=ids).select_related(
        "ingredient",
        "owner_user",
        "owner_user__profile",
    )


def user_can_access_inventory_row(*, user, row: UserIngredientInventory) -> bool:
    return row.owner_user_id in pantry_owner_user_ids(user=user)


def partner_display_label_for_row(*, viewer, row: UserIngredientInventory) -> str:
    if row.owner_user_id == viewer.id:
        return ""
    profile = getattr(row.owner_user, "profile", None)
    if profile is None:
        return (row.owner_user.email or "").split("@")[0] or "Partner"
    nick = (profile.display_name or "").strip()
    if nick:
        return nick
    email = (row.owner_user.email or "").strip()
    if email and "@" in email:
        return email.split("@")[0].strip()
    return "Partner"


def normalize_dietary_preference_list(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        s = item.strip()[:64]
        if not s:
            continue
        fold = s.casefold()
        if fold in seen:
            continue
        seen.add(fold)
        out.append(s)
    return out


def profile_dietary_preferences(profile) -> list[str]:
    return normalize_dietary_preference_list(getattr(profile, "meal_dietary_preferences", None))


def apply_pantry_tags_for_user(
    *,
    user,
    row: UserIngredientInventory,
    client_tags: object | None,
    tags_key_sent: bool,
    on_create: bool = False,
) -> None:
    """Merge client pantry_tags with profile dietary defaults when dietary not explicitly set."""
    from users.models import Profile

    profile, _ = Profile.objects.get_or_create(user=user)
    prefs = profile_dietary_preferences(profile)
    if tags_key_sent:
        normalized = normalize_pantry_tags(client_tags)
        if not normalized["dietary"] and prefs:
            normalized["dietary"] = list(prefs)
        row.pantry_tags = normalized
        return
    if on_create and prefs:
        base = normalize_pantry_tags(row.pantry_tags)
        base["dietary"] = _merge_dietary(base["dietary"], prefs)
        row.pantry_tags = base


def _merge_dietary(existing: list[str], prefs: list[str]) -> list[str]:
    seen = {t.casefold() for t in existing}
    out = list(existing)
    for p in prefs:
        if p.casefold() not in seen:
            seen.add(p.casefold())
            out.append(p)
    return out
