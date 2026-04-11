"""Clone meals (partner disconnect, friend shared recipes)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from meal.ingredients import ensure_ingredient_for_owner, label_for_ingredient_row
from meal.models import Meal, MealCategoryOption, MealIngredient, MealTag
from meal.tagging import get_or_create_tag_for_owner

User = get_user_model()


def _ensure_option_for_owner(*, owner, source_opt: MealCategoryOption | None) -> MealCategoryOption | None:
    if source_opt is None:
        return None
    opt, _ = MealCategoryOption.objects.get_or_create(
        owner_user=owner,
        axis=source_opt.axis,
        name=source_opt.name,
    )
    return opt


def _copy_tags_to_owner(*, meal: Meal, new_owner):
    tags: list[MealTag] = []
    for tag in meal.tags.all():
        tags.append(get_or_create_tag_for_owner(owner=new_owner, name=tag.name))
    return tags


@transaction.atomic
def clone_meal_for_user(*, meal: Meal, new_owner: User, set_cloned_from: bool = True) -> Meal:
    """
    Deep-copy meal row, ingredients, tags (re-keyed to new_owner), and category options
    (get_or_create per axis+name for new_owner).
    """
    new_meal = Meal.objects.create(
        owner_user=new_owner,
        title=meal.title,
        blurb=meal.blurb,
        directions=meal.directions,
        source_url=meal.source_url,
        image_key=meal.image_key,
        cloned_from_meal=meal if set_cloned_from else None,
        is_published_to_friends=False,
        meal_type_option=_ensure_option_for_owner(owner=new_owner, source_opt=meal.meal_type_option),
        cuisine_option=_ensure_option_for_owner(owner=new_owner, source_opt=meal.cuisine_option),
        time_option=_ensure_option_for_owner(owner=new_owner, source_opt=meal.time_option),
    )
    for ing in meal.ingredients.all().order_by("position", "id"):
        label = label_for_ingredient_row(
            raw_line=ing.raw_line,
            amount=ing.amount,
            unit=ing.unit,
            name=ing.name,
        )
        vocab = ensure_ingredient_for_owner(owner=new_owner, label=label) if label else None
        MealIngredient.objects.create(
            meal=new_meal,
            position=ing.position,
            raw_line=ing.raw_line,
            amount=ing.amount,
            unit=ing.unit,
            name=ing.name,
            ingredient=vocab,
        )
    tag_objs = _copy_tags_to_owner(meal=meal, new_owner=new_owner)
    if tag_objs:
        new_meal.tags.set(tag_objs)
    return new_meal

