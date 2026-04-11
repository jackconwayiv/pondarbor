"""Owner-scoped ingredient catalog for meal lines, grocery merge, and pantry."""

from __future__ import annotations

from collections.abc import Iterable

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from meal.models import Ingredient, MealIngredient
from meal.recipe_import import parse_ingredient_line


def label_for_ingredient_row(*, raw_line: str, amount: str, unit: str, name: str) -> str:
    """Best-effort canonical label for deduplication and display."""
    n = (name or "").strip()
    if n:
        return n[:255]
    parsed = parse_ingredient_line(raw_line or "")
    n2 = (parsed.get("name") or "").strip()
    if n2:
        return n2[:255]
    text = (raw_line or "").strip()
    if text:
        return text[:255]
    return ""


def ensure_ingredient_for_owner(*, owner, label: str) -> Ingredient | None:
    raw = (label or "").strip()
    if not raw:
        return None
    existing = Ingredient.objects.filter(owner_user=owner, name__iexact=raw).first()
    if existing:
        return existing
    return Ingredient.objects.create(owner_user=owner, name=raw[:255])


def resolve_meal_ingredient_fk(
    *,
    owner,
    row: dict,
    meal_owner,
) -> Ingredient | None:
    """Resolve ingredient FK from explicit id or from parsed line text."""
    explicit = row.get("ingredient_id")
    if explicit is not None:
        try:
            iid = int(explicit)
        except (TypeError, ValueError):
            iid = None
        if iid is not None:
            ing = Ingredient.objects.filter(pk=iid, owner_user=meal_owner).first()
            if ing is None:
                raise ValidationError({"ingredients": f"Invalid ingredient_id {iid}."})
            return ing
    label = label_for_ingredient_row(
        raw_line=row.get("raw_line") or "",
        amount=row.get("amount") or "",
        unit=row.get("unit") or "",
        name=row.get("name") or "",
    )
    return ensure_ingredient_for_owner(owner=meal_owner, label=label)


def ingredient_vocab_qs(*, owner, q: str):
    qs = Ingredient.objects.filter(owner_user=owner).order_by("name")
    q = (q or "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q))
    return qs[:200]


def reattach_ingredient_for_meal_line(mi: MealIngredient) -> None:
    """Set ingredient FK from parsed line (used in migrations and repair)."""
    meal = mi.meal
    label = label_for_ingredient_row(
        raw_line=mi.raw_line,
        amount=mi.amount,
        unit=mi.unit,
        name=mi.name,
    )
    if not label:
        if mi.ingredient_id:
            mi.ingredient = None
            mi.save(update_fields=["ingredient"])
        return
    ing = ensure_ingredient_for_owner(owner=meal.owner_user, label=label)
    if mi.ingredient_id != ing.id:
        mi.ingredient = ing
        mi.save(update_fields=["ingredient"])


def repair_null_meal_ingredient_fks(
    *,
    meal_ids: Iterable[int] | None = None,
    owner_user_ids: Iterable[int] | None = None,
) -> None:
    """
    Link MealIngredient rows that still lack ``ingredient_id`` to the owner vocabulary.

    Recipe lines are stored as text; catalog FKs power pantry matching, meal search by
    ingredient, and consistent grocery grouping. Call before reads that filter on
    ``ingredients__ingredient_id``.
    """
    if (meal_ids is None) == (owner_user_ids is None):
        raise ValueError("Specify exactly one of meal_ids or owner_user_ids")

    qs = MealIngredient.objects.filter(ingredient_id__isnull=True).select_related("meal")
    if meal_ids is not None:
        mids = list(meal_ids)
        if not mids:
            return
        qs = qs.filter(meal_id__in=mids)
    else:
        ouids = list(owner_user_ids)
        if not ouids:
            return
        qs = qs.filter(meal__owner_user_id__in=ouids)

    for mi in qs.iterator():
        reattach_ingredient_for_meal_line(mi)
