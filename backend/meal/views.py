from __future__ import annotations

from datetime import date

from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from users.auth0_backend import Auth0TokenAuthentication
from users.permissions import IsApprovedUser
from users.views import get_or_create_profile

from meal.dates import normalize_week_start
from meal.grid import copy_template_to_instance, create_template_with_grid, rebuild_template_slots
from meal.grocery_build import generate_grocery_list_for_instance
from meal.models import (
    GroceryList,
    Meal,
    MealPlanInstance,
    MealPlanInstanceSlot,
    MealPlanTemplate,
    MealPlanTemplateSlot,
    MealRecipe,
    Recipe,
)
from meal.partner import meal_partner_user_ids
from meal.serializers import (
    GroceryListSerializer,
    MealPlanInstanceSerializer,
    MealPlanTemplateSerializer,
    MealPlanTemplateWriteSerializer,
    MealSerializer,
    MealWriteSerializer,
    RecipeSerializer,
    RecipeWriteSerializer,
)


def _scope_ids(request):
    return meal_partner_user_ids(user=request.user)


def _recipe_qs(request):
    return Recipe.objects.filter(owner_user_id__in=_scope_ids(request))


def _meal_qs(request):
    return Meal.objects.filter(owner_user_id__in=_scope_ids(request))


def _template_qs(request):
    return MealPlanTemplate.objects.filter(owner_user_id__in=_scope_ids(request))


def _instance_qs(request):
    return MealPlanInstance.objects.filter(owner_user_id__in=_scope_ids(request))


def _grocery_qs(request):
    return GroceryList.objects.filter(owner_user_id__in=_scope_ids(request))


def _assert_scope_write(request, owner_id: int) -> None:
    """Writable if you own the object or it belongs to your mutual meal partner."""
    if owner_id not in _scope_ids(request):
        raise PermissionDenied("You cannot modify this object.")


def _validate_meal_ref(request, meal_id: int | None) -> None:
    if meal_id is None:
        return
    if not _meal_qs(request).filter(id=meal_id).exists():
        raise ValidationError({"meal_id": "Meal not found or not accessible."})


def _validate_recipe_ref(request, recipe_id: int | None) -> None:
    if recipe_id is None:
        return
    if not _recipe_qs(request).filter(id=recipe_id).exists():
        raise ValidationError({"recipe_id": "Recipe not found or not accessible."})


def _meal_prefetch_recipes():
    return Prefetch(
        "meal_recipes",
        queryset=MealRecipe.objects.order_by("position", "id")
        .select_related("recipe")
        .prefetch_related("recipe__ingredients"),
    )


def _set_meal_recipes_from_ids(*, meal: Meal, recipe_ids: list[int]) -> None:
    meal.meal_recipes.all().delete()
    for i, rid in enumerate(recipe_ids):
        MealRecipe.objects.create(meal=meal, recipe_id=rid, position=i)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def recipe_list_create(request):
    if request.method == "GET":
        qs = _recipe_qs(request).prefetch_related("ingredients").order_by("-updated_at")
        return Response(RecipeSerializer(qs, many=True).data)
    ser = RecipeWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    recipe = ser.save(owner_user=request.user)
    recipe = _recipe_qs(request).prefetch_related("ingredients").get(pk=recipe.pk)
    return Response(RecipeSerializer(recipe).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def recipe_detail(request, pk: int):
    recipe = get_object_or_404(_recipe_qs(request).prefetch_related("ingredients"), pk=pk)
    if request.method == "GET":
        return Response(RecipeSerializer(recipe).data)
    _assert_scope_write(request, recipe.owner_user_id)
    if request.method == "DELETE":
        recipe.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = RecipeWriteSerializer(recipe, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    recipe.refresh_from_db()
    recipe = _recipe_qs(request).prefetch_related("ingredients").get(pk=recipe.pk)
    return Response(RecipeSerializer(recipe).data)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_list_create(request):
    if request.method == "GET":
        qs = (
            _meal_qs(request)
            .prefetch_related(_meal_prefetch_recipes())
            .order_by("-updated_at")
        )
        return Response(MealSerializer(qs, many=True).data)
    ser = MealWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    recipe_ids = list(ser.validated_data.get("recipe_ids") or [])
    for rid in recipe_ids:
        _validate_recipe_ref(request, rid)
    meal = Meal.objects.create(
        owner_user=request.user,
        title=(ser.validated_data.get("title") or "").strip(),
        blurb=ser.validated_data.get("blurb") or "",
    )
    _set_meal_recipes_from_ids(meal=meal, recipe_ids=recipe_ids)
    meal = _meal_qs(request).prefetch_related(_meal_prefetch_recipes()).get(pk=meal.pk)
    return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_detail(request, pk: int):
    meal = get_object_or_404(
        _meal_qs(request).prefetch_related(_meal_prefetch_recipes()),
        pk=pk,
    )
    if request.method == "GET":
        return Response(MealSerializer(meal).data)
    _assert_scope_write(request, meal.owner_user_id)
    if request.method == "DELETE":
        meal.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = MealWriteSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    if "recipe_ids" in ser.validated_data:
        recipe_ids = list(ser.validated_data["recipe_ids"])
        for rid in recipe_ids:
            _validate_recipe_ref(request, rid)
        _set_meal_recipes_from_ids(meal=meal, recipe_ids=recipe_ids)
    if "title" in ser.validated_data:
        meal.title = (ser.validated_data["title"] or "").strip()
    if "blurb" in ser.validated_data:
        meal.blurb = ser.validated_data["blurb"]
    meal.save()
    meal.refresh_from_db()
    meal = _meal_qs(request).prefetch_related(_meal_prefetch_recipes()).get(pk=meal.pk)
    return Response(MealSerializer(meal).data)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_list_create(request):
    if request.method == "GET":
        qs = _template_qs(request).prefetch_related("slots").order_by("-updated_at")
        return Response(MealPlanTemplateSerializer(qs, many=True).data)
    ser = MealPlanTemplateWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    t = create_template_with_grid(
        owner=request.user,
        name=ser.validated_data["name"],
        description=ser.validated_data.get("description", ""),
        slots_per_day=ser.validated_data.get("slots_per_day", 3),
    )
    t = _template_qs(request).prefetch_related("slots").get(pk=t.pk)
    return Response(MealPlanTemplateSerializer(t).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_detail(request, pk: int):
    template = get_object_or_404(_template_qs(request).prefetch_related("slots"), pk=pk)
    if request.method == "GET":
        return Response(MealPlanTemplateSerializer(template).data)
    _assert_scope_write(request, template.owner_user_id)
    if request.method == "DELETE":
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = MealPlanTemplateWriteSerializer(template, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    old_n = template.slots_per_day
    for k, v in ser.validated_data.items():
        setattr(template, k, v)
    template.save()
    if "slots_per_day" in ser.validated_data and ser.validated_data["slots_per_day"] != old_n:
        rebuild_template_slots(template)
    template = _template_qs(request).prefetch_related("slots").get(pk=template.pk)
    return Response(MealPlanTemplateSerializer(template).data)


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_grid(request, pk: int):
    template = get_object_or_404(_template_qs(request).prefetch_related("slots"), pk=pk)
    _assert_scope_write(request, template.owner_user_id)
    slots_payload = request.data.get("slots")
    if not isinstance(slots_payload, list):
        raise ValidationError({"slots": "Expected a list of {day_index, slot_index, meal_id}."})
    n = template.slots_per_day
    for row in slots_payload:
        if not isinstance(row, dict):
            raise ValidationError({"slots": "Each slot must be an object."})
        d = row.get("day_index")
        s = row.get("slot_index")
        mid = row.get("meal_id")
        if not isinstance(d, int) or not isinstance(s, int):
            raise ValidationError({"slots": "day_index and slot_index must be integers."})
        if d < 0 or d > 6 or s < 0 or s >= n:
            raise ValidationError({"slots": "Slot out of range for this template."})
        _validate_meal_ref(request, mid)
        MealPlanTemplateSlot.objects.filter(
            template=template,
            day_index=d,
            slot_index=s,
        ).update(meal_id=mid)
    template.refresh_from_db()
    template = _template_qs(request).prefetch_related("slots").get(pk=template.pk)
    return Response(MealPlanTemplateSerializer(template).data)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_list_create(request):
    if request.method == "GET":
        qs = _instance_qs(request).prefetch_related("slots").order_by("-week_start")
        return Response(MealPlanInstanceSerializer(qs, many=True).data)
    data = request.data
    template_id = data.get("template_id")
    week_raw = data.get("week_start")
    if template_id is None or week_raw is None:
        raise ValidationError({"detail": "template_id and week_start are required."})
    template = get_object_or_404(_template_qs(request), pk=int(template_id))
    _assert_scope_write(request, template.owner_user_id)
    if isinstance(week_raw, str):
        week_d = date.fromisoformat(week_raw)
    else:
        raise ValidationError({"week_start": "Use an ISO date string (YYYY-MM-DD)."})
    profile = get_or_create_profile(request.user)
    week_start = normalize_week_start(week_d, profile.meal_week_starts_on)
    if MealPlanInstance.objects.filter(owner_user=request.user, week_start=week_start).exists():
        raise ValidationError({"week_start": "You already have a plan instance for this week."})
    inst = MealPlanInstance.objects.create(
        owner_user=request.user,
        source_template=template,
        week_start=week_start,
    )
    copy_template_to_instance(template=template, instance=inst)
    inst = _instance_qs(request).prefetch_related("slots").get(pk=inst.pk)
    return Response(MealPlanInstanceSerializer(inst).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_detail(request, pk: int):
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    if request.method == "GET":
        return Response(MealPlanInstanceSerializer(inst).data)
    _assert_scope_write(request, inst.owner_user_id)
    if request.method == "DELETE":
        inst.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    # no mutable fields in MVP except maybe week_start - skip PATCH body for now
    return Response(MealPlanInstanceSerializer(inst).data)


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_grid(request, pk: int):
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    _assert_scope_write(request, inst.owner_user_id)
    slots_payload = request.data.get("slots")
    if not isinstance(slots_payload, list):
        raise ValidationError({"slots": "Expected a list of {day_index, slot_index, meal_id}."})
    n = inst.source_template.slots_per_day if inst.source_template_id else 3
    for row in slots_payload:
        if not isinstance(row, dict):
            raise ValidationError({"slots": "Each slot must be an object."})
        d = row.get("day_index")
        s = row.get("slot_index")
        mid = row.get("meal_id")
        if not isinstance(d, int) or not isinstance(s, int):
            raise ValidationError({"slots": "day_index and slot_index must be integers."})
        if d < 0 or d > 6 or s < 0 or s >= n:
            raise ValidationError({"slots": "Slot out of range for this instance."})
        _validate_meal_ref(request, mid)
        MealPlanInstanceSlot.objects.filter(
            instance=inst,
            day_index=d,
            slot_index=s,
        ).update(meal_id=mid)
    inst = _instance_qs(request).prefetch_related("slots").get(pk=inst.pk)
    return Response(MealPlanInstanceSerializer(inst).data)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def grocery_generate(request, pk: int):
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    _assert_scope_write(request, inst.owner_user_id)
    gl = generate_grocery_list_for_instance(inst)
    gl = _grocery_qs(request).prefetch_related("items").get(pk=gl.pk)
    return Response(GroceryListSerializer(gl).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def grocery_detail(request, pk: int):
    gl = get_object_or_404(_grocery_qs(request).prefetch_related("items"), pk=pk)
    return Response(GroceryListSerializer(gl).data)
