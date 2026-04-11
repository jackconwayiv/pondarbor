from __future__ import annotations

import logging
import os
import uuid
from datetime import date

from django.conf import settings
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from common.r2_s3 import build_r2_s3_client, r2_bucket_config_from_env

from users.auth0_backend import Auth0TokenAuthentication
from users.permissions import IsApprovedUser
from users.views import get_or_create_profile

from achievements.services import (
    evaluate_meal_maestro_friend_recipe_copy_for_user,
    evaluate_meal_maestro_tasty_plans_for_instance,
)

from friends.services import are_friends, friend_ids_for_user

from meal.clone import clone_meal_for_user
from meal.dates import normalize_week_start
from meal.import_hints import apply_import_hints_to_meal, build_import_hints_from_paprika_category_string
from meal.grid import copy_template_to_instance, create_template_with_grid, rebuild_template_slots
from meal.grocery_build import generate_grocery_list_for_instance
from meal.meal_updates import apply_meal_validated, attach_upcoming_slot_counts, filter_meals_queryset
from meal.models import (
    GroceryList,
    Meal,
    MealCategoryOption,
    MealIngredient,
    MealPlanInstance,
    MealPlanInstanceSlotMeal,
    MealPlanTemplate,
    MealPlanTemplateSlotMeal,
    MealTag,
)
from meal.partner import meal_partner_user_ids
from meal.paprika_import import (
    decode_paprika_photo_base64,
    iter_paprika_recipes_from_bytes,
    paprika_object_to_meal_payload,
)
from meal.recipe_import import (
    extract_recipe_from_html,
    fetch_recipe_html,
    fetch_recipe_image_bytes,
    validate_http_url,
)
from meal.r2_storage import expected_meal_image_key_prefix, upload_meal_image_bytes
from meal.publish import meal_eligible_for_publish
from meal.serializers import (
    GroceryListSerializer,
    MealCategoryOptionSerializer,
    MealImportFromUrlSerializer,
    MealPlanInstanceSerializer,
    MealPlanTemplateSerializer,
    MealPlanTemplateWriteSerializer,
    MealSerializer,
    MealWriteSerializer,
    SharedMealSerializer,
)

logger = logging.getLogger(__name__)


def _meal_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


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


def _meal_detail_prefetch():
    return (
        "ingredients",
        Prefetch("tags", queryset=MealTag.objects.order_by("name")),
        "meal_type_option",
        "cuisine_option",
        "time_option",
    )


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_list_create(request):
    if request.method == "GET":
        qs = _meal_qs(request).prefetch_related(*_meal_detail_prefetch())
        qs, sort = filter_meals_queryset(request, qs)
        meals = list(qs)
        attach_upcoming_slot_counts(meals, _scope_ids(request))
        if sort == "upcoming_slot_count":
            meals.sort(
                key=lambda m: (
                    -getattr(m, "_upcoming_slot_count", 0),
                    (m.title or "").lower(),
                ),
            )
        return Response(MealSerializer(meals, many=True).data)
    ser = MealWriteSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    vd = ser.validated_data
    meal = Meal.objects.create(
        owner_user=request.user,
        title=(vd.get("title") or "").strip(),
        blurb=vd.get("blurb") or "",
        directions=vd.get("directions") or "",
        source_url=(vd.get("source_url") or "")[:2048],
        image_key=(vd.get("image_key") or "")[:512],
        is_published_to_friends=False,
    )
    _set_meal_ingredients(meal=meal, ingredients_data=list(vd.get("ingredients") or []))
    meal.refresh_from_db()
    apply_meal_validated(meal=meal, data=vd, partial=False)
    meal.save()
    meal = _meal_qs(request).prefetch_related(*_meal_detail_prefetch()).get(pk=meal.pk)
    return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_import_from_url(request):
    ser = MealImportFromUrlSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    raw_url = ser.validated_data["url"]
    normalized = validate_http_url(raw_url)
    html, final_url = fetch_recipe_html(normalized)
    data = extract_recipe_from_html(html, final_url)
    hints = data.pop("import_hints", None) or {}
    meal = Meal.objects.create(
        owner_user=request.user,
        title=data["title"],
        blurb=data.get("blurb") or "",
        directions=data.get("directions") or "",
        source_url=(data.get("canonical_url") or "")[:2048],
    )
    ing_rows = []
    for i, ing in enumerate(data.get("ingredients") or []):
        ing_rows.append(
            {
                "position": i,
                "raw_line": ing.get("raw_line", ""),
                "amount": ing.get("amount", ""),
                "unit": ing.get("unit", ""),
                "name": ing.get("name", ""),
            },
        )
    _set_meal_ingredients(meal=meal, ingredients_data=ing_rows)
    if hints:
        apply_import_hints_to_meal(meal=meal, hints=hints)
    if data.get("recipe_image_url"):
        try:
            img_bytes = fetch_recipe_image_bytes(data["recipe_image_url"])
            meal.image_key = upload_meal_image_bytes(
                user_id=request.user.id,
                data=img_bytes,
                label="url",
            )
            meal.save(update_fields=["image_key", "updated_at"])
        except Exception as exc:
            logger.warning("meal url import: skipped image: %s", exc)
    meal = _meal_qs(request).prefetch_related(*_meal_detail_prefetch()).get(pk=meal.pk)
    return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
@parser_classes([MultiPartParser, FormParser])
def meal_import_paprika(request):
    upload = request.FILES.get("file")
    if not upload:
        raise ValidationError({"file": "No file uploaded."})
    raw = upload.read()
    max_zip = _meal_env_int("MEAL_PAPRIKA_IMPORT_MAX_BYTES", 50 * 1024 * 1024)
    if len(raw) > max_zip:
        raise ValidationError({"file": f"File too large (max {max_zip} bytes)."})
    try:
        recipe_dicts = iter_paprika_recipes_from_bytes(data=raw, filename=upload.name)
    except ValueError as e:
        raise ValidationError({"file": str(e)}) from e
    max_recipes = _meal_env_int("MEAL_PAPRIKA_IMPORT_MAX_RECIPES", 500)
    if len(recipe_dicts) > max_recipes:
        raise ValidationError({"file": f"Too many recipes in one file (max {max_recipes})."})

    created: list[Meal] = []
    errors: list[dict] = []
    for idx, obj in enumerate(recipe_dicts):
        try:
            payload = paprika_object_to_meal_payload(obj)
            photo_b64 = payload.pop("photo_data_base64", None)
            paprika_cats = (payload.pop("paprika_categories", None) or "").strip()
            title = (payload.get("title") or "").strip()
            if not title:
                raise ValueError("Recipe has no name.")
            meal = Meal.objects.create(
                owner_user=request.user,
                title=title[:255],
                blurb=payload.get("blurb") or "",
                directions=payload.get("directions") or "",
                source_url=(payload.get("source_url") or "")[:2048],
            )
            ing_rows = []
            for i, row in enumerate(payload.get("ingredients") or []):
                ing_rows.append(
                    {
                        "position": i,
                        "raw_line": row.get("raw_line", ""),
                        "amount": row.get("amount", ""),
                        "unit": row.get("unit", ""),
                        "name": row.get("name", ""),
                    },
                )
            _set_meal_ingredients(meal=meal, ingredients_data=ing_rows)
            if paprika_cats:
                ph = build_import_hints_from_paprika_category_string(paprika_cats)
                if ph:
                    apply_import_hints_to_meal(meal=meal, hints=ph)
            if photo_b64:
                blob = decode_paprika_photo_base64(photo_b64)
                if blob:
                    try:
                        meal.image_key = upload_meal_image_bytes(
                            user_id=request.user.id,
                            data=blob,
                            label="paprika",
                        )
                        meal.save(update_fields=["image_key", "updated_at"])
                    except Exception as exc:
                        logger.warning("paprika import: skipped image for %s: %s", title, exc)
            created.append(meal)
        except Exception as exc:
            errors.append({"index": idx, "error": str(exc)})
    out = [
        MealSerializer(_meal_qs(request).prefetch_related(*_meal_detail_prefetch()).get(pk=m.pk)).data
        for m in created
    ]
    return Response({"meals": out, "imported_count": len(out), "errors": errors}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_uploads_presign(request):
    """Presign R2 PUT for meal recipe photos (same bucket as Closet)."""
    max_bytes = _meal_env_int("MEAL_IMAGE_MAX_BYTES", 2 * 1024 * 1024)
    expires_seconds = min(_meal_env_int("MEAL_UPLOAD_EXPIRES_SECONDS", 900), 604800)
    mime = request.data.get("content_type", "image/jpeg")
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        return Response({"detail": "Unsupported image mime type."}, status=400)

    config = r2_bucket_config_from_env()
    if not config:
        return Response(
            {
                "detail": "R2 is not configured.",
                "required_env": [
                    "CLOSET_R2_BUCKET",
                    "CLOSET_R2_ACCESS_KEY_ID",
                    "CLOSET_R2_SECRET_ACCESS_KEY",
                    "CLOUDFLARE_ACCOUNT_ID (or CLOSET_R2_S3_ENDPOINT_URL)",
                ],
            },
            status=501,
        )

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]
    key_root = expected_meal_image_key_prefix(request.user.id).rstrip("/")
    key = f"{key_root}/{timezone.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
    try:
        client = build_r2_s3_client(config)
    except RuntimeError as exc:
        return Response(
            {
                "detail": str(exc) if settings.DEBUG else "Storage client failed to initialize.",
            },
            status=503,
        )
    presigned_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": config["bucket"],
            "Key": key,
            "ContentType": mime,
        },
        ExpiresIn=expires_seconds,
    )
    return Response(
        {
            "key": key,
            "upload_url": presigned_url,
            "expires_in_seconds": expires_seconds,
            "max_bytes": max_bytes,
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
        }
    )


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_detail(request, pk: int):
    meal = get_object_or_404(
        _meal_qs(request).prefetch_related(*_meal_detail_prefetch()),
        pk=pk,
    )
    if request.method == "GET":
        scope = _scope_ids(request)
        attach_upcoming_slot_counts([meal], scope)
        return Response(MealSerializer(meal).data)
    _assert_scope_write(request, meal.owner_user_id)
    if request.method == "DELETE":
        meal.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = MealWriteSerializer(data=request.data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    vd = ser.validated_data
    if "title" in vd:
        meal.title = (vd["title"] or "").strip()
    if "blurb" in vd:
        meal.blurb = vd["blurb"]
    if "directions" in vd:
        meal.directions = vd["directions"]
    if "source_url" in vd:
        meal.source_url = (vd.get("source_url") or "")[:2048]
    if "image_key" in vd:
        meal.image_key = (vd.get("image_key") or "")[:512]
    if "ingredients" in vd:
        _set_meal_ingredients(meal=meal, ingredients_data=list(vd["ingredients"]))
    meal.save()
    meal.refresh_from_db()
    apply_meal_validated(meal=meal, data=vd, partial=True)
    meal.save()
    meal = _meal_qs(request).prefetch_related(*_meal_detail_prefetch()).get(pk=meal.pk)
    return Response(MealSerializer(meal).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_tag_vocab(request):
    names = list(
        MealTag.objects.filter(owner_user=request.user).order_by("name").values_list("name", flat=True),
    )
    return Response({"tags": names})


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_category_options_list(request):
    if request.method == "POST":
        axis = (request.data.get("axis") or "").strip()
        name = (request.data.get("name") or "").strip()
        if axis not in ("meal_type", "cuisine", "time"):
            raise ValidationError({"axis": "Use meal_type, cuisine, or time."})
        if not name:
            raise ValidationError({"name": "Name is required."})
        from meal.tagging import ensure_category_option

        opt = ensure_category_option(owner=request.user, axis=axis, name=name)
        return Response(MealCategoryOptionSerializer(opt).data, status=status.HTTP_201_CREATED)

    axis = (request.GET.get("axis") or "").strip()
    if axis not in ("meal_type", "cuisine", "time"):
        raise ValidationError({"axis": "Use axis=meal_type, cuisine, or time."})
    qs = MealCategoryOption.objects.filter(owner_user=request.user, axis=axis).order_by("name")
    return Response(MealCategoryOptionSerializer(qs, many=True).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_shared_list(request):
    friend_ids = friend_ids_for_user(user=request.user)
    cloned_sources = Meal.objects.filter(owner_user=request.user).exclude(cloned_from_meal_id=None).values_list(
        "cloned_from_meal_id",
        flat=True,
    )
    qs = (
        Meal.objects.filter(owner_user_id__in=friend_ids, is_published_to_friends=True)
        .exclude(pk__in=cloned_sources)
        .select_related("owner_user", "owner_user__profile")
        .prefetch_related(*_meal_detail_prefetch())
        .order_by("-updated_at")
    )
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(blurb__icontains=q) | Q(directions__icontains=q))
    return Response(SharedMealSerializer(list(qs), many=True).data)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_copy_from_friend(request, pk: int):
    source = get_object_or_404(
        Meal.objects.select_related("owner_user", "owner_user__profile").prefetch_related(
            "ingredients",
            "tags",
            "meal_type_option",
            "cuisine_option",
            "time_option",
        ),
        pk=pk,
    )
    if not source.is_published_to_friends or not meal_eligible_for_publish(source):
        raise ValidationError({"detail": "This recipe is not available to copy."})
    if not are_friends(user_a=request.user, user_b=source.owner_user):
        raise PermissionDenied("You can only copy recipes from friends.")
    if Meal.objects.filter(owner_user=request.user, cloned_from_meal=source).exists():
        raise ValidationError({"detail": "You already saved this recipe."})
    new_meal = clone_meal_for_user(meal=source, new_owner=request.user, set_cloned_from=True)
    evaluate_meal_maestro_friend_recipe_copy_for_user(request.user.id)
    new_meal = (
        Meal.objects.filter(owner_user=request.user, pk=new_meal.pk)
        .prefetch_related(*_meal_detail_prefetch())
        .first()
    )
    attach_upcoming_slot_counts([new_meal], _scope_ids(request))
    return Response(MealSerializer(new_meal).data, status=status.HTTP_201_CREATED)


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
    evaluate_meal_maestro_tasty_plans_for_instance(instance_id=inst.pk)
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
    evaluate_meal_maestro_tasty_plans_for_instance(instance_id=inst.pk)
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
