"""Pantry inventory vs meal ingredient matching (coverage %, legacy buckets)."""

from __future__ import annotations

from dataclasses import dataclass, field

from django.contrib.auth.models import AbstractBaseUser

from meal.ingredients import label_for_ingredient_row, repair_null_meal_ingredient_fks
from meal.models import Meal, MealIngredient, UserIngredientInventory
from meal.pantry_staples import is_assumed_pantry_staple
from meal.partner import meal_partner_user_ids


@dataclass
class MissingIngredient:
    ingredient_id: int | None
    name: str

    def key(self) -> str:
        if self.ingredient_id is not None:
            return f"i:{self.ingredient_id}"
        return f"n:{self.name.casefold()}"


@dataclass
class PantryRecipeMatch:
    meal_id: int
    title: str
    missing: list[MissingIngredient] = field(default_factory=list)

    @property
    def missing_count(self) -> int:
        return len(self.missing)


def pantry_available_ingredient_ids(*, owner_user_ids: set[int] | int) -> set[int]:
    """Ingredient ids in pantry for one or more owners (any location row counts)."""
    if isinstance(owner_user_ids, int):
        ids = {owner_user_ids}
    else:
        ids = owner_user_ids
    available: set[int] = set()
    if not ids:
        return available
    for iid, qty, simple in UserIngredientInventory.objects.filter(
        owner_user_id__in=ids,
    ).values_list("ingredient_id", "quantity", "simple_have"):
        if qty > 0 or simple is True:
            available.add(iid)
    return available


def pantry_available_names(*, owner_user_ids: set[int] | int) -> set[str]:
    """Casefolded ingredient names in pantry (in-stock rows)."""
    if isinstance(owner_user_ids, int):
        ids = {owner_user_ids}
    else:
        ids = owner_user_ids
    names: set[str] = set()
    if not ids:
        return names
    for name, qty, simple in UserIngredientInventory.objects.filter(
        owner_user_id__in=ids,
    ).select_related("ingredient").values_list("ingredient__name", "quantity", "simple_have"):
        if qty > 0 or simple is True:
            n = (name or "").strip().casefold()
            if n:
                names.add(n)
    return names


def _line_ingredient_name(line: MealIngredient) -> str:
    iid = line.ingredient_id
    if iid is not None:
        ing = getattr(line, "ingredient", None)
        name = (ing.name if ing else "") or line.name
    else:
        name = label_for_ingredient_row(
            raw_line=line.raw_line,
            amount=line.amount,
            unit=line.unit,
            name=line.name,
        )
    return (name or line.raw_line or "Unknown ingredient").strip()[:255]


def _missing_for_meal(
    *,
    lines: list[MealIngredient],
    available_ids: set[int],
    available_names: set[str],
) -> list[MissingIngredient]:
    missing_by_key: dict[str, MissingIngredient] = {}
    for line in lines:
        iid = line.ingredient_id
        name = _line_ingredient_name(line)
        if is_assumed_pantry_staple(name):
            continue
        if iid is not None and iid in available_ids:
            continue
        if name.casefold() in available_names:
            continue
        item = MissingIngredient(ingredient_id=iid, name=name)
        missing_by_key[item.key()] = item
    return list(missing_by_key.values())


def _required_ingredient_count(lines: list[MealIngredient]) -> int:
    keys: set[str] = set()
    for line in lines:
        name = _line_ingredient_name(line)
        if is_assumed_pantry_staple(name):
            continue
        iid = line.ingredient_id
        if iid is not None:
            keys.add(f"i:{iid}")
        else:
            keys.add(f"n:{name.casefold()}")
    return len(keys)


def pantry_coverage_for_meal(
    *,
    lines: list[MealIngredient],
    available_ids: set[int],
    available_names: set[str],
) -> int | None:
    """Return 0–100 coverage, or None when the meal has no countable ingredients."""
    required = _required_ingredient_count(lines)
    if required == 0:
        return None
    missing = _missing_for_meal(
        lines=lines,
        available_ids=available_ids,
        available_names=available_names,
    )
    owned = required - len(missing)
    return round(100 * owned / required)


def attach_pantry_coverage(*, meals: list[Meal], user: AbstractBaseUser) -> None:
    scope = meal_partner_user_ids(user=user)
    repair_null_meal_ingredient_fks(owner_user_ids=scope)
    available_ids = pantry_available_ingredient_ids(owner_user_ids=scope)
    available_names = pantry_available_names(owner_user_ids=scope)
    for meal in meals:
        lines = list(meal.ingredients.all())
        meal._pantry_coverage_pct = pantry_coverage_for_meal(
            lines=lines,
            available_ids=available_ids,
            available_names=available_names,
        )


def match_meals_to_pantry(
    *,
    meals: list[Meal],
    available_ingredient_ids: set[int],
    available_names: set[str] | None = None,
    almost_max_missing: int = 3,
) -> tuple[list[PantryRecipeMatch], list[PantryRecipeMatch]]:
    """
    Return (can_make, almost_make) for meals with at least one ingredient line.

    almost_make: missing 1..almost_max_missing unique ingredients.
    """
    names = available_names if available_names is not None else set()
    can_make: list[PantryRecipeMatch] = []
    almost_make: list[PantryRecipeMatch] = []

    for meal in meals:
        lines = list(meal.ingredients.all())
        if not lines:
            continue
        title = (meal.title or "").strip() or "Untitled"
        missing = _missing_for_meal(
            lines=lines,
            available_ids=available_ingredient_ids,
            available_names=names,
        )
        match = PantryRecipeMatch(meal_id=meal.id, title=title, missing=missing)
        if match.missing_count == 0:
            can_make.append(match)
        elif 1 <= match.missing_count <= almost_max_missing:
            almost_make.append(match)

    sort_key = lambda m: m.title.casefold()
    can_make.sort(key=sort_key)
    almost_make.sort(key=sort_key)
    return can_make, almost_make
