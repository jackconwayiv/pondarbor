"""
Best-effort mapping from schema.org Recipe JSON-LD to Meal tags / category names.

Applied after URL import; creates owner-scoped options via meal.tagging.ensure_category_option.
"""

from __future__ import annotations

import re
from typing import Any

from meal.models import Meal, MealCategoryAxis
from meal.tagging import ensure_category_option, replace_meal_tags


def _minutes_from_iso8601_duration(raw: str | None) -> int | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip().upper()
    if not s.startswith("P"):
        return None
    # PnDTnHnMnS — day/hour/minute chunks
    days = hours = minutes = 0
    m = re.search(r"(\d+)D", s)
    if m:
        days = int(m.group(1))
    m = re.search(r"(\d+)H", s)
    if m:
        hours = int(m.group(1))
    m = re.search(r"(\d+)M", s)
    if m:
        minutes = int(m.group(1))
    total = days * 24 * 60 + hours * 60 + minutes
    return total if total > 0 else None


def _time_bucket_name(total_minutes: int | None) -> str | None:
    if total_minutes is None:
        return None
    if total_minutes < 20:
        return "Quick"
    if total_minutes <= 45:
        return "Average"
    return "Elaborate"


def _tokenize_categories(val: Any) -> list[str]:
    out: list[str] = []
    if isinstance(val, str) and val.strip():
        for part in re.split(r"[,;|]", val):
            t = part.strip()
            if t:
                out.append(t)
    elif isinstance(val, list):
        for x in val:
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
    return out


def _infer_meal_type_from_tokens(tokens: list[str]) -> str | None:
    joined = " ".join(tokens).lower()
    if any(x in joined for x in ("breakfast", "brunch")):
        return "Breakfast"
    if "lunch" in joined:
        return "Lunch"
    if "dinner" in joined or "supper" in joined:
        return "Dinner"
    if "snack" in joined:
        return "Snack"
    if "dessert" in joined or "sweet" in joined:
        return "Dessert"
    if "side" in joined:
        return "Side"
    if "soup" in joined:
        return "Soup"
    if "entree" in joined or "main" in joined:
        return "Entree"
    return None


def _infer_cuisine_from_tokens(tokens: list[str]) -> str | None:
    joined = " ".join(tokens).lower()
    mapping = [
        ("mexican", "Mexican"),
        ("thai", "Thai"),
        ("french", "French"),
        ("italian", "Italian"),
        ("chinese", "Chinese"),
        ("japanese", "Japanese"),
        ("indian", "Indian"),
        ("mediterranean", "Mediterranean"),
        ("american", "American"),
    ]
    for needle, label in mapping:
        if needle in joined:
            return label
    rc = None
    for t in tokens:
        tl = t.strip()
        if 2 < len(tl) < 40 and tl[0].isupper():
            # recipeCuisine sometimes a single proper noun
            rc = tl
    return rc


def build_import_hints_from_paprika_category_string(categories: str) -> dict[str, Any]:
    """Paprika exports often store categories as a single string."""
    if not (categories or "").strip():
        return {}
    return build_import_hints_from_json_ld({"recipeCategory": categories.strip()})


def build_import_hints_from_json_ld(recipe: dict[str, Any] | None) -> dict[str, Any]:
    """Return suggested_tags, meal_type, cuisine, time bucket names (strings)."""
    if not recipe:
        return {}
    tokens: list[str] = []
    tokens.extend(_tokenize_categories(recipe.get("recipeCategory")))
    tokens.extend(_tokenize_categories(recipe.get("keywords")))
    kw = recipe.get("recipeCuisine")
    if isinstance(kw, str) and kw.strip():
        tokens.append(kw.strip())
    elif isinstance(kw, list):
        for x in kw:
            if isinstance(x, str) and x.strip():
                tokens.append(x.strip())

    tag_candidates: list[str] = []
    for t in tokens:
        low = t.lower()
        if low in {"dinner", "lunch", "breakfast"}:
            continue
        if len(t) >= 2 and len(t) < 80:
            tag_candidates.append(t)

    # de-dupe case-insensitive
    seen: set[str] = set()
    suggested_tags: list[str] = []
    for t in tag_candidates:
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        suggested_tags.append(t[:120])

    prep = _minutes_from_iso8601_duration(_as_duration(recipe.get("prepTime")))
    cook = _minutes_from_iso8601_duration(_as_duration(recipe.get("cookTime")))
    total = _minutes_from_iso8601_duration(_as_duration(recipe.get("totalTime")))
    minutes = total
    if minutes is None:
        minutes = (prep or 0) + (cook or 0) or None
    time_name = _time_bucket_name(minutes)

    mt = _infer_meal_type_from_tokens(tokens)
    cu = _infer_cuisine_from_tokens(tokens)
    if isinstance(recipe.get("recipeCuisine"), str) and (recipe.get("recipeCuisine") or "").strip():
        cu = cu or recipe["recipeCuisine"].strip()

    out: dict[str, Any] = {}
    if suggested_tags:
        out["suggested_tags"] = suggested_tags[:25]
    if mt:
        out["meal_type_name"] = mt
    if cu:
        out["cuisine_name"] = cu
    if time_name:
        out["time_name"] = time_name
    return out


def _as_duration(val: Any) -> str | None:
    if isinstance(val, str):
        return val
    return None


def apply_import_hints_to_meal(*, meal: Meal, hints: dict[str, Any]) -> None:
    """Mutates meal; saves category FKs and tags. Caller should refresh."""
    if not hints:
        return
    owner = meal.owner_user
    tag_names = list(hints.get("suggested_tags") or [])
    if tag_names:
        try:
            replace_meal_tags(meal=meal, tag_names=tag_names)
        except ValueError:
            pass

    try:
        if hints.get("meal_type_name"):
            meal.meal_type_option = ensure_category_option(
                owner=owner,
                axis=MealCategoryAxis.MEAL_TYPE.value,
                name=str(hints["meal_type_name"]),
            )
        if hints.get("cuisine_name"):
            meal.cuisine_option = ensure_category_option(
                owner=owner,
                axis=MealCategoryAxis.CUISINE.value,
                name=str(hints["cuisine_name"]),
            )
        if hints.get("time_name"):
            meal.time_option = ensure_category_option(
                owner=owner,
                axis=MealCategoryAxis.TIME.value,
                name=str(hints["time_name"]),
            )
    except ValueError:
        pass
    meal.save()
