from __future__ import annotations

from datetime import date

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
    MealIngredient,
    MealPlanInstance,
    MealPlanInstanceSlotMeal,
    MealPlanTemplate,
    MealPlanTemplateSlotMeal,
)
from meal.partner import meal_partner_user_ids
from meal.serializers import (
    GroceryListSerializer,
    MealPlanInstanceSerializer,
    MealPlanTemplateSerializer,
    MealPlanTemplateWriteSerializer,
    MealSerializer,
    MealWriteSerializer,
)


def _scope_ids(request):
    return meal_partner_user_ids(user=request.user)


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


def _validate_meal_refs(request, meal_ids: list[int]) -> None:
    if not meal_ids:
        return
    allowed = set(_meal_qs(request).filter(id__in=meal_ids).values_list("id", flat=True))
    missing = [m for m in meal_ids if m not in allowed]
    if missing:
        raise ValidationError({"meal_ids": "One or more meals are not accessible."})


def _set_meal_ingredients(*, meal: Meal, ingredients_data: list[dict]) -> None:
    meal.ingredients.all().delete()
    for i, row in enumerate(ingredients_data):
        MealIngredient.objects.create(
            meal=meal,
            position=row.get("position", i),
            raw_line=row.get("raw_line", ""),
            amount=row.get("amount", ""),
            unit=row.get("unit", ""),
            name=row.get("name", ""),
        )


def _serialize_template(template: MealPlanTemplate):
    payload = MealPlanTemplateSerializer(template).data
    by_key: dict[tuple[int, int], list[int]] = {}
    for link in MealPlanTemplateSlotMeal.objects.filter(slot__template=template).select_related("slot"):
        key = (link.slot.day_index, link.slot.slot_index)
        by_key.setdefault(key, []).append(link.meal_id)
    for slot in payload["slots"]:
        slot["meal_ids"] = by_key.get((slot["day_index"], slot["slot_index"]), [])
    return payload


def _serialize_instance(inst: MealPlanInstance):
    payload = MealPlanInstanceSerializer(inst).data
    by_key: dict[tuple[int, int], list[int]] = {}
    for link in MealPlanInstanceSlotMeal.objects.filter(slot__instance=inst).select_related("slot"):
        key = (link.slot.day_index, link.slot.slot_index)
        by_key.setdefault(key, []).append(link.meal_id)
    for slot in payload["slots"]:
        slot["meal_ids"] = by_key.get((slot["day_index"], slot["slot_index"]), [])
    return payload


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_list_create(request):
    if request.method == "GET":
        qs = _meal_qs(request).prefetch_related("ingredients").order_by("-updated_at")
        return Response(MealSerializer(qs, many=True).data)
    ser = MealWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    meal = Meal.objects.create(
        owner_user=request.user,
        title=(ser.validated_data.get("title") or "").strip(),
        blurb=ser.validated_data.get("blurb") or "",
        directions=ser.validated_data.get("directions") or "",
    )
    _set_meal_ingredients(meal=meal, ingredients_data=list(ser.validated_data.get("ingredients") or []))
    meal = _meal_qs(request).prefetch_related("ingredients").get(pk=meal.pk)
    return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_detail(request, pk: int):
    meal = get_object_or_404(
        _meal_qs(request).prefetch_related("ingredients"),
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
    if "title" in ser.validated_data:
        meal.title = (ser.validated_data["title"] or "").strip()
    if "blurb" in ser.validated_data:
        meal.blurb = ser.validated_data["blurb"]
    if "directions" in ser.validated_data:
        meal.directions = ser.validated_data["directions"]
    if "ingredients" in ser.validated_data:
        _set_meal_ingredients(meal=meal, ingredients_data=list(ser.validated_data["ingredients"]))
    meal.save()
    meal.refresh_from_db()
    meal = _meal_qs(request).prefetch_related("ingredients").get(pk=meal.pk)
    return Response(MealSerializer(meal).data)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_list_create(request):
    if request.method == "GET":
        qs = _template_qs(request).prefetch_related("slots").order_by("-updated_at")
        return Response([_serialize_template(t) for t in qs])
    ser = MealPlanTemplateWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    t = create_template_with_grid(
        owner=request.user,
        name=ser.validated_data["name"],
        description=ser.validated_data.get("description", ""),
        slots_per_day=ser.validated_data.get("slots_per_day", 3),
    )
    t = _template_qs(request).prefetch_related("slots").get(pk=t.pk)
    return Response(_serialize_template(t), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_detail(request, pk: int):
    template = get_object_or_404(_template_qs(request).prefetch_related("slots"), pk=pk)
    if request.method == "GET":
        return Response(_serialize_template(template))
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
    return Response(_serialize_template(template))


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def template_grid(request, pk: int):
    template = get_object_or_404(_template_qs(request).prefetch_related("slots"), pk=pk)
    _assert_scope_write(request, template.owner_user_id)
    slots_payload = request.data.get("slots")
    if not isinstance(slots_payload, list):
        raise ValidationError({"slots": "Expected a list of {day_index, slot_index, meal_ids}."})
    n = template.slots_per_day
    for row in slots_payload:
        if not isinstance(row, dict):
            raise ValidationError({"slots": "Each slot must be an object."})
        d = row.get("day_index")
        s = row.get("slot_index")
        mids = row.get("meal_ids")
        if not isinstance(d, int) or not isinstance(s, int):
            raise ValidationError({"slots": "day_index and slot_index must be integers."})
        if d < 0 or d > 6 or s < 0 or s >= n:
            raise ValidationError({"slots": "Slot out of range for this template."})
        if not isinstance(mids, list) or not all(isinstance(mid, int) for mid in mids):
            raise ValidationError({"slots": "meal_ids must be an array of integers."})
        _validate_meal_refs(request, mids)
        slot = get_object_or_404(template.slots, day_index=d, slot_index=s)
        MealPlanTemplateSlotMeal.objects.filter(slot=slot).exclude(meal_id__in=mids).delete()
        for mid in mids:
            MealPlanTemplateSlotMeal.objects.get_or_create(slot=slot, meal_id=mid)
    template.refresh_from_db()
    template = _template_qs(request).prefetch_related("slots").get(pk=template.pk)
    return Response(_serialize_template(template))


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_list_create(request):
    if request.method == "GET":
        qs = _instance_qs(request).prefetch_related("slots").order_by("-week_start")
        return Response([_serialize_instance(inst) for inst in qs])
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
    return Response(_serialize_instance(inst), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_detail(request, pk: int):
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    if request.method == "GET":
        return Response(_serialize_instance(inst))
    _assert_scope_write(request, inst.owner_user_id)
    if request.method == "DELETE":
        inst.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    # no mutable fields in MVP except maybe week_start - skip PATCH body for now
    return Response(_serialize_instance(inst))


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_grid(request, pk: int):
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    _assert_scope_write(request, inst.owner_user_id)
    slots_payload = request.data.get("slots")
    if not isinstance(slots_payload, list):
        raise ValidationError({"slots": "Expected a list of {day_index, slot_index, meal_ids}."})
    n = inst.source_template.slots_per_day if inst.source_template_id else 3
    for row in slots_payload:
        if not isinstance(row, dict):
            raise ValidationError({"slots": "Each slot must be an object."})
        d = row.get("day_index")
        s = row.get("slot_index")
        mids = row.get("meal_ids")
        if not isinstance(d, int) or not isinstance(s, int):
            raise ValidationError({"slots": "day_index and slot_index must be integers."})
        if d < 0 or d > 6 or s < 0 or s >= n:
            raise ValidationError({"slots": "Slot out of range for this instance."})
        if not isinstance(mids, list) or not all(isinstance(mid, int) for mid in mids):
            raise ValidationError({"slots": "meal_ids must be an array of integers."})
        _validate_meal_refs(request, mids)
        slot = get_object_or_404(inst.slots, day_index=d, slot_index=s)
        MealPlanInstanceSlotMeal.objects.filter(slot=slot).exclude(meal_id__in=mids).delete()
        for mid in mids:
            MealPlanInstanceSlotMeal.objects.get_or_create(slot=slot, meal_id=mid)
    inst = _instance_qs(request).prefetch_related("slots").get(pk=inst.pk)
    return Response(_serialize_instance(inst))


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
