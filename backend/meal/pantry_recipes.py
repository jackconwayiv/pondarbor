"""Match owner meals against pantry inventory for can-make / almost-make lists."""

from __future__ import annotations

from dataclasses import dataclass, field

from meal.ingredients import label_for_ingredient_row
from meal.models import Meal, MealIngredient, UserIngredientInventory
from meal.pantry_staples import is_assumed_pantry_staple


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


def _missing_for_meal(*, lines: list[MealIngredient], available: set[int]) -> list[MissingIngredient]:
    missing_by_key: dict[str, MissingIngredient] = {}
    for line in lines:
        iid = line.ingredient_id
        if iid is not None and iid in available:
            continue
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
        name = (name or line.raw_line or "Unknown ingredient").strip()[:255]
        if is_assumed_pantry_staple(name):
            continue
        item = MissingIngredient(ingredient_id=iid, name=name)
        missing_by_key[item.key()] = item
    return list(missing_by_key.values())


def match_meals_to_pantry(
    *,
    meals: list[Meal],
    available_ingredient_ids: set[int],
    almost_max_missing: int = 3,
) -> tuple[list[PantryRecipeMatch], list[PantryRecipeMatch]]:
    """
    Return (can_make, almost_make) for meals with at least one ingredient line.

    almost_make: missing 1..almost_max_missing unique ingredients.
    """
    can_make: list[PantryRecipeMatch] = []
    almost_make: list[PantryRecipeMatch] = []

    for meal in meals:
        lines = list(meal.ingredients.all())
        if not lines:
            continue
        title = (meal.title or "").strip() or "Untitled"
        missing = _missing_for_meal(lines=lines, available=available_ingredient_ids)
        match = PantryRecipeMatch(meal_id=meal.id, title=title, missing=missing)
        if match.missing_count == 0:
            can_make.append(match)
        elif 1 <= match.missing_count <= almost_max_missing:
            almost_make.append(match)

    sort_key = lambda m: m.title.casefold()
    can_make.sort(key=sort_key)
    almost_make.sort(key=sort_key)
    return can_make, almost_make


def serialize_pantry_recipe_match(match: PantryRecipeMatch) -> dict:
    return {
        "meal_id": match.meal_id,
        "title": match.title,
        "missing_count": match.missing_count,
        "missing_ingredients": [
            {"ingredient_id": m.ingredient_id, "name": m.name} for m in match.missing
        ],
    }
