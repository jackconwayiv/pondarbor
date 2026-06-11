from __future__ import annotations

import logging
import os
import uuid
from datetime import date

from django.conf import settings
from django.db.models import Max, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from common.r2_s3 import build_r2_s3_client, r2_bucket_config_from_env, r2_read_expires_seconds

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
from meal.grid import create_instance_with_grid, slots_per_day_for_user
from meal.grocery_build import generate_grocery_list_for_instance
from meal.ingredients import ingredient_vocab_qs, repair_null_meal_ingredient_fks, resolve_meal_ingredient_fk
from meal.meal_updates import apply_meal_validated, attach_upcoming_slot_counts, filter_meals_queryset
from meal.models import (
    GroceryList,
    GroceryListItem,
    Ingredient,
    Meal,
    MealCategoryOption,
    MealIngredient,
    MealPlanInstance,
    MealPlanInstanceSlotMeal,
    MealTag,
    SavedGroceryList,
    UserIngredientInventory,
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
    GroceryListItemSerializer,
    GroceryListSerializer,
    IngredientBriefSerializer,
    MealCategoryOptionSerializer,
    MealImportFromUrlSerializer,
    MealPlanInstanceSerializer,
    MealSerializer,
    MealWriteSerializer,
    SavedGroceryListSerializer,
    SharedMealSerializer,
    UserIngredientInventorySerializer,
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


def _maybe_attach_pantry_coverage(request, meals: list[Meal]) -> None:
    from users.models import Profile

    from meal.pantry_recipes import attach_pantry_coverage

    profile, _ = Profile.objects.get_or_create(user=request.user)
    if not profile.meal_pantry_enabled:
        return
    attach_pantry_coverage(meals=meals, user=request.user)


def _meal_qs(request):
    return Meal.objects.filter(owner_user_id__in=_scope_ids(request))


def _instance_qs(request):
    return MealPlanInstance.objects.filter(owner_user_id__in=_scope_ids(request))


def _grocery_qs(request):
    return GroceryList.objects.filter(owner_user_id__in=_scope_ids(request))


def _assert_scope_write(request, owner_id: int) -> None:
    """Writable if you own the object or it belongs to your mutual meal partner."""
    if owner_id not in _scope_ids(request):
        raise PermissionDenied("You cannot modify this object.")


def _meal_readable(request, meal: Meal) -> bool:
    if meal.owner_user_id in _scope_ids(request):
        return True
    return bool(
        meal.is_published_to_friends
        and meal_eligible_for_publish(meal)
        and are_friends(user_a=request.user, user_b=meal.owner_user)
    )


def _validate_meal_refs(request, meal_ids: list[int]) -> None:
    if not meal_ids:
        return
    allowed = set(_meal_qs(request).filter(id__in=meal_ids).values_list("id", flat=True))
    missing = [m for m in meal_ids if m not in allowed]
    if missing:
        raise ValidationError({"meal_ids": "One or more meals are not accessible."})


def _set_meal_ingredients(*, meal: Meal, ingredients_data: list[dict]) -> None:
    meal.ingredients.all().delete()
    owner = meal.owner_user
    for i, row in enumerate(ingredients_data):
        raw_line = row.get("raw_line", "")
        amount = row.get("amount", "")
        unit = row.get("unit", "")
        name = row.get("name", "")
        row_d = {
            "raw_line": raw_line,
            "amount": amount,
            "unit": unit,
            "name": name,
            "ingredient_id": row.get("ingredient_id"),
        }
        fk = resolve_meal_ingredient_fk(owner=owner, row=row_d, meal_owner=owner)
        MealIngredient.objects.create(
            meal=meal,
            position=row.get("position", i),
            raw_line=raw_line,
            amount=amount,
            unit=unit,
            name=name,
            ingredient=fk,
        )


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
        _maybe_attach_pantry_coverage(request, meals)
        if sort == "upcoming_slot_count":
            meals.sort(
                key=lambda m: (
                    -getattr(m, "_upcoming_slot_count", 0),
                    (m.title or "").lower(),
                ),
            )
        elif sort == "pantry_coverage_pct":
            meals.sort(
                key=lambda m: (
                    -(
                        getattr(m, "_pantry_coverage_pct", None)
                        if getattr(m, "_pantry_coverage_pct", None) is not None
                        else -1
                    ),
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
    read_expires = r2_read_expires_seconds()
    view_url = client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": config["bucket"], "Key": key},
        ExpiresIn=read_expires,
    )
    return Response(
        {
            "key": key,
            "upload_url": presigned_url,
            "view_url": view_url,
            "expires_in_seconds": expires_seconds,
            "view_expires_in_seconds": read_expires,
            "max_bytes": max_bytes,
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
        }
    )


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_detail(request, pk: int):
    meal = get_object_or_404(
        Meal.objects.select_related("owner_user", "owner_user__profile").prefetch_related(
            *_meal_detail_prefetch()
        ),
        pk=pk,
    )
    if not _meal_readable(request, meal):
        raise PermissionDenied("You cannot view this meal.")
    if request.method == "GET":
        scope = _scope_ids(request)
        attach_upcoming_slot_counts([meal], scope)
        _maybe_attach_pantry_coverage(request, [meal])
        if meal.owner_user_id in scope:
            return Response(MealSerializer(meal).data)
        return Response(SharedMealSerializer(meal).data)
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


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_tag_seed(request):
    """Create meal tags for the current user without attaching to a meal."""
    from meal.tagging import get_or_create_tag_for_owner

    raw = request.data.get("tags") or request.data.get("tag_names") or []
    if not isinstance(raw, list):
        raise ValidationError({"tags": "Must be a list of tag names."})
    created: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        name = item.strip()
        if not name:
            continue
        get_or_create_tag_for_owner(owner=request.user, name=name)
        created.append(name)
    names = list(
        MealTag.objects.filter(owner_user=request.user).order_by("name").values_list("name", flat=True),
    )
    return Response({"tags": names, "seeded": created})


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
    meals = list(qs)
    _maybe_attach_pantry_coverage(request, meals)
    return Response(SharedMealSerializer(meals, many=True).data)


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
def instance_list_create(request):
    if request.method == "GET":
        qs = _instance_qs(request).prefetch_related("slots").order_by("-week_start")
        return Response([_serialize_instance(inst) for inst in qs])
    data = request.data
    week_raw = data.get("week_start")
    if week_raw is None:
        raise ValidationError({"week_start": "Required (ISO date YYYY-MM-DD)."})
    if isinstance(week_raw, str):
        week_d = date.fromisoformat(week_raw)
    else:
        raise ValidationError({"week_start": "Use an ISO date string (YYYY-MM-DD)."})
    profile = get_or_create_profile(request.user)
    week_start = normalize_week_start(week_d, profile.meal_week_starts_on)
    if MealPlanInstance.objects.filter(owner_user=request.user, week_start=week_start).exists():
        raise ValidationError({"week_start": "You already have a plan instance for this week."})
    inst = create_instance_with_grid(owner=request.user, week_start=week_start)
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
    n = slots_per_day_for_user(inst.owner_user)
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
    mids = (
        MealPlanInstanceSlotMeal.objects.filter(slot__instance_id=inst.pk)
        .values_list("meal_id", flat=True)
        .distinct()
    )
    repair_null_meal_ingredient_fks(meal_ids=list(mids))
    pantry_param = (request.GET.get("pantry") or "").strip().lower()
    pantry_aware = pantry_param in ("1", "true", "yes")
    pantry_owner_user_ids = None
    if pantry_aware:
        from users.models import Profile

        profile, _ = Profile.objects.get_or_create(user=request.user)
        if not profile.meal_pantry_enabled:
            raise ValidationError({"pantry": "Enable pantry tracking to generate a pantry-aware list."})
        pantry_owner_user_ids = _scope_ids(request)
    gl = generate_grocery_list_for_instance(
        inst,
        pantry_aware=pantry_aware,
        pantry_owner_user_ids=pantry_owner_user_ids,
    )
    gl = _grocery_qs(request).prefetch_related("items").get(pk=gl.pk)
    return Response(GroceryListSerializer(gl).data)


@api_view(["GET", "PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def grocery_detail(request, pk: int):
    gl = get_object_or_404(_grocery_qs(request).prefetch_related("items"), pk=pk)
    if request.method == "PATCH":
        _assert_scope_write(request, gl.owner_user_id)
        if "hide_checked" in request.data:
            gl.hide_checked = bool(request.data["hide_checked"])
            gl.save(update_fields=["hide_checked", "updated_at"])
        gl = _grocery_qs(request).prefetch_related("items").get(pk=gl.pk)
    return Response(GroceryListSerializer(gl).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def instance_grocery_retrieve(request, pk: int):
    """Return the grocery list for a week instance without regenerating lines (preserves checks)."""
    inst = get_object_or_404(_instance_qs(request).prefetch_related("slots"), pk=pk)
    gl = (
        _grocery_qs(request)
        .filter(instance_id=inst.pk)
        .prefetch_related("items")
        .first()
    )
    if gl is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(GroceryListSerializer(gl).data)


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def grocery_list_item_patch(request, item_id: int):
    item = get_object_or_404(
        GroceryListItem.objects.select_related("grocery_list"),
        pk=item_id,
    )
    if item.grocery_list.owner_user_id not in _scope_ids(request):
        raise PermissionDenied()
    _assert_scope_write(request, item.grocery_list.owner_user_id)
    if "is_checked" in request.data:
        item.is_checked = bool(request.data["is_checked"])
    if "display_text" in request.data and item.manually_added:
        item.display_text = str(request.data["display_text"])[:512]
    item.save()
    return Response(GroceryListItemSerializer(item).data)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def grocery_list_add_item(request, pk: int):
    gl = get_object_or_404(_grocery_qs(request), pk=pk)
    _assert_scope_write(request, gl.owner_user_id)
    ingredient_id = request.data.get("ingredient_id")
    display_text = (request.data.get("display_text") or "").strip()
    qty = (request.data.get("quantity") or "")[:64]
    unit = (request.data.get("unit") or "")[:64]
    ing = None
    if ingredient_id is not None:
        ing = Ingredient.objects.filter(pk=int(ingredient_id), owner_user=gl.owner_user).first()
        if not ing:
            raise ValidationError({"ingredient_id": "Invalid ingredient for this account."})
        if not display_text:
            display_text = ing.name
    elif display_text:
        from meal.ingredients import ensure_ingredient_for_owner

        ing = ensure_ingredient_for_owner(owner=gl.owner_user, label=display_text)
    else:
        raise ValidationError({"detail": "Provide ingredient_id or display_text."})

    max_pos = gl.items.aggregate(m=Max("position"))["m"]
    max_pos = max_pos if max_pos is not None else -1
    item = GroceryListItem.objects.create(
        grocery_list=gl,
        position=max_pos + 1,
        display_text=display_text[:512],
        quantity=qty,
        unit=unit,
        manually_added=True,
        ingredient=ing,
        is_checked=False,
        contributions=[
            {
                "meal_id": None,
                "meal_title": "Added",
                "display": display_text[:512],
                "quantity": qty,
                "unit": unit,
            },
        ],
    )
    return Response(GroceryListItemSerializer(item).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def ingredient_vocab(request):
    q = (request.GET.get("q") or "").strip()
    rows = ingredient_vocab_qs(owner=request.user, q=q)
    return Response(IngredientBriefSerializer(rows, many=True).data)


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def ingredient_detail(request, pk: int):
    from meal.ingredient_display_emoji import normalize_display_emoji
    from meal.ingredient_food_group import normalize_food_group

    ing = get_object_or_404(Ingredient.objects.filter(owner_user=request.user), pk=pk)
    update_fields: list[str] = []
    if "food_group" in request.data:
        ing.food_group = normalize_food_group(request.data.get("food_group"))
        update_fields.append("food_group")
    if "display_emoji" in request.data:
        ing.display_emoji = normalize_display_emoji(request.data.get("display_emoji"))
        update_fields.append("display_emoji")
    if update_fields:
        ing.save(update_fields=update_fields)
    return Response(IngredientBriefSerializer(ing).data)


@api_view(["GET", "POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def saved_grocery_list(request):
    if request.method == "GET":
        qs = SavedGroceryList.objects.filter(owner_user=request.user).order_by("-saved_at", "-id")
        return Response(SavedGroceryListSerializer(qs, many=True).data)
    gl_id = request.data.get("grocery_list_id")
    label = (request.data.get("label") or "").strip()[:255]
    if gl_id is None:
        raise ValidationError({"grocery_list_id": "Required."})
    gl = get_object_or_404(_grocery_qs(request).prefetch_related("items"), pk=int(gl_id))
    _assert_scope_write(request, gl.owner_user_id)
    items = [
        {
            "display_text": it.display_text,
            "quantity": it.quantity,
            "unit": it.unit,
            "contributions": it.contributions or [],
            "ingredient_id": it.ingredient_id,
            "is_checked": it.is_checked,
            "manually_added": it.manually_added,
        }
        for it in gl.items.all().order_by("position", "id")
    ]
    snap = {"items": items, "source_grocery_list_id": gl.id}
    saved = SavedGroceryList.objects.create(
        owner_user=request.user,
        label=label,
        source_instance_id=gl.instance_id,
        snapshot=snap,
    )
    return Response(SavedGroceryListSerializer(saved).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def saved_grocery_detail(request, pk: int):
    obj = get_object_or_404(SavedGroceryList.objects.filter(owner_user=request.user), pk=pk)
    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(SavedGroceryListSerializer(obj).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def pantry_inventory_list(request):
    from users.models import Profile

    from meal.pantry_access import pantry_inventory_queryset
    from meal.pantry_recommendations import (
        attach_pantry_recommendation_hints,
        in_stock_ingredient_recommendation_hints,
    )

    qs = pantry_inventory_queryset(user=request.user)
    rows = list(qs)
    profile, _ = Profile.objects.get_or_create(user=request.user)
    if profile.meal_pantry_enabled:
        hints = in_stock_ingredient_recommendation_hints(
            user=request.user,
            scope_ids=_scope_ids(request),
            instance_qs=_instance_qs(request),
            meal_qs=_meal_qs(request),
            inventory_qs=qs,
            week_starts_on=int(profile.meal_week_starts_on),
        )
        attach_pantry_recommendation_hints(rows=rows, hints=hints)
    return Response(
        UserIngredientInventorySerializer(rows, many=True, context={"request": request}).data,
    )


@api_view(["PUT"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def pantry_inventory_put(request):
    """Upsert one inventory row by ingredient_id and optional location, or update by inventory_id."""
    from meal.pantry_access import apply_pantry_tags_for_user, user_can_access_inventory_row

    location = str(request.data.get("location") or "").strip()[:120]
    qty = request.data.get("quantity")
    simple = request.data.get("simple_have")
    inventory_id = request.data.get("inventory_id")
    tags_key_sent = "pantry_tags" in request.data
    if inventory_id is not None:
        row = get_object_or_404(
            UserIngredientInventory.objects.select_related("owner_user", "ingredient"),
            pk=int(inventory_id),
        )
        if not user_can_access_inventory_row(user=request.user, row=row):
            raise PermissionDenied("Not allowed to edit this pantry row.")
        row.location = location
        is_create = False
    else:
        ingredient_id = request.data.get("ingredient_id")
        if ingredient_id is None:
            raise ValidationError({"ingredient_id": "Required."})
        ing = get_object_or_404(Ingredient.objects.filter(owner_user=request.user), pk=int(ingredient_id))
        row, is_create = UserIngredientInventory.objects.get_or_create(
            owner_user=request.user,
            ingredient=ing,
            location=location,
            defaults={"quantity": 0},
        )
        row.ingredient = ing
    if qty is not None:
        try:
            row.quantity = max(0, int(qty))
        except (TypeError, ValueError):
            raise ValidationError({"quantity": "Must be a non-negative integer."})
        row.simple_have = None
    if simple is not None:
        if simple in (True, "true", "1", 1):
            row.simple_have = True
        elif simple in (False, "false", "0", 0):
            row.simple_have = False
        else:
            row.simple_have = None
    apply_pantry_tags_for_user(
        user=request.user,
        row=row,
        client_tags=request.data.get("pantry_tags") if tags_key_sent else None,
        tags_key_sent=tags_key_sent,
        on_create=is_create,
    )
    if "food_group" in request.data or "display_emoji" in request.data:
        from meal.ingredient_display_emoji import normalize_display_emoji
        from meal.ingredient_food_group import normalize_food_group

        if not user_can_access_inventory_row(user=request.user, row=row):
            raise PermissionDenied("Not allowed to edit this pantry row.")
        ing = row.ingredient
        ing_update_fields: list[str] = []
        if "food_group" in request.data:
            ing.food_group = normalize_food_group(request.data.get("food_group"))
            ing_update_fields.append("food_group")
        if "display_emoji" in request.data:
            ing.display_emoji = normalize_display_emoji(request.data.get("display_emoji"))
            ing_update_fields.append("display_emoji")
        if ing_update_fields:
            ing.save(update_fields=ing_update_fields)
    row.save()
    return Response(
        UserIngredientInventorySerializer(row, context={"request": request}).data,
    )


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def pantry_inventory_parse(request):
    from meal.pantry_import import parse_pantry_text, parsed_pantry_items_to_dicts

    text = request.data.get("text")
    if text is None:
        raise ValidationError({"text": "Required."})
    items = parse_pantry_text(str(text))
    return Response({"items": parsed_pantry_items_to_dicts(items)})


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def pantry_inventory_import(request):
    from meal.ingredients import ensure_ingredient_for_owner
    from meal.pantry_import import parse_pantry_text

    text = request.data.get("text")
    if text is None:
        raise ValidationError({"text": "Required."})
    merge = (request.data.get("merge") or "set").strip().lower()
    if merge not in ("set", "add"):
        raise ValidationError({"merge": "Must be 'set' or 'add'."})

    items = [it for it in parse_pantry_text(str(text)) if not it.skipped and not it.is_section_header and it.name]
    saved: list[UserIngredientInventory] = []
    for item in items:
        ing = ensure_ingredient_for_owner(owner=request.user, label=item.name)
        if ing is None:
            continue
        location = (item.location or "")[:120]
        row, _ = UserIngredientInventory.objects.get_or_create(
            owner_user=request.user,
            ingredient=ing,
            location=location,
            defaults={"quantity": 0},
        )
        if merge == "add":
            row.quantity = row.quantity + item.quantity
        else:
            row.quantity = max(0, item.quantity)
        row.simple_have = None
        from meal.pantry_access import apply_pantry_tags_for_user

        apply_pantry_tags_for_user(
            user=request.user,
            row=row,
            client_tags=None,
            tags_key_sent=False,
            on_create=True,
        )
        row.save()
        saved.append(row)

    qs = UserIngredientInventory.objects.filter(pk__in=[r.pk for r in saved]).select_related(
        "ingredient",
        "owner_user",
        "owner_user__profile",
    )
    by_id = {r.id: r for r in qs}
    ordered = [by_id[r.id] for r in saved if r.id in by_id]
    return Response(
        {
            "imported": len(ordered),
            "items": UserIngredientInventorySerializer(
                ordered,
                many=True,
                context={"request": request},
            ).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def meal_bootstrap(request):
    """Initial Meal Maestro payload: meals, plans, pantry, vocab, shared browse."""
    from meal.bootstrap import meal_bootstrap_payload

    return Response(meal_bootstrap_payload(request=request))

