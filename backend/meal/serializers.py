from __future__ import annotations

from rest_framework import serializers

from meal.models import (
    GroceryList,
    GroceryListItem,
    Ingredient,
    Meal,
    MealCategoryOption,
    MealIngredient,
    MealPlanInstance,
    SavedGroceryList,
    UserIngredientInventory,
)
from meal.publish import meal_eligible_for_publish
from meal.r2_storage import meal_image_public_url, validate_meal_image_key_for_user


class MealIngredientSerializer(serializers.ModelSerializer):
    ingredient_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = MealIngredient
        fields = ("id", "position", "raw_line", "amount", "unit", "name", "ingredient_id")


class MealCategoryOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealCategoryOption
        fields = ("id", "name", "axis")


class MealSerializer(serializers.ModelSerializer):
    ingredients = MealIngredientSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    tag_names = serializers.SerializerMethodField()
    meal_type = serializers.SerializerMethodField()
    cuisine = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    upcoming_slot_count = serializers.SerializerMethodField()
    past_slot_count = serializers.SerializerMethodField()
    pantry_coverage_pct = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = (
            "id",
            "owner_user",
            "title",
            "blurb",
            "directions",
            "ingredients",
            "cloned_from_meal",
            "source_url",
            "image_key",
            "image_url",
            "is_published_to_friends",
            "tag_names",
            "meal_type",
            "cuisine",
            "time",
            "upcoming_slot_count",
            "past_slot_count",
            "pantry_coverage_pct",
            "can_publish",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner_user",
            "cloned_from_meal",
            "created_at",
            "updated_at",
        )

    def get_image_url(self, obj: Meal) -> str:
        return meal_image_public_url(obj.image_key or "")

    def get_tag_names(self, obj: Meal) -> list[str]:
        return [t.name for t in obj.tags.all().order_by("name")]

    def _opt_brief(self, opt):
        if opt is None:
            return None
        return {"id": opt.id, "name": opt.name, "axis": opt.axis}

    def get_meal_type(self, obj: Meal):
        return self._opt_brief(obj.meal_type_option)

    def get_cuisine(self, obj: Meal):
        return self._opt_brief(obj.cuisine_option)

    def get_time(self, obj: Meal):
        return self._opt_brief(obj.time_option)

    def get_upcoming_slot_count(self, obj: Meal) -> int:
        v = getattr(obj, "_upcoming_slot_count", None)
        if v is not None:
            return int(v)
        return 0

    def get_past_slot_count(self, obj: Meal) -> int:
        v = getattr(obj, "_past_slot_count", None)
        if v is not None:
            return int(v)
        return 0

    def get_pantry_coverage_pct(self, obj: Meal) -> int | None:
        v = getattr(obj, "_pantry_coverage_pct", None)
        if v is None:
            return None
        return int(v)

    def get_can_publish(self, obj: Meal) -> bool:
        return meal_eligible_for_publish(obj)


class MealWriteSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    blurb = serializers.CharField(required=False, allow_blank=True)
    directions = serializers.CharField(required=False, allow_blank=True)
    ingredients = MealIngredientSerializer(many=True, required=False)
    source_url = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    image_key = serializers.CharField(required=False, allow_blank=True, max_length=512)
    tag_names = serializers.ListField(child=serializers.CharField(max_length=120), required=False)
    meal_type_id = serializers.IntegerField(required=False, allow_null=True)
    cuisine_id = serializers.IntegerField(required=False, allow_null=True)
    time_id = serializers.IntegerField(required=False, allow_null=True)
    is_published_to_friends = serializers.BooleanField(required=False)

    def validate_image_key(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return validate_meal_image_key_for_user(value, user)


class SharedMealSerializer(MealSerializer):
    """Published friend meal for browse + copy flows."""

    author_display = serializers.SerializerMethodField()

    class Meta(MealSerializer.Meta):
        fields = MealSerializer.Meta.fields + ("author_display",)

    def get_author_display(self, obj: Meal) -> str:
        u = getattr(obj, "owner_user", None)
        if u is None:
            return ""
        prof = getattr(u, "profile", None)
        if prof and (prof.display_name or "").strip():
            return (prof.display_name or "").strip()
        return (getattr(u, "email", None) or "") or ""

    def get_upcoming_slot_count(self, obj: Meal) -> int:
        return 0

    def get_past_slot_count(self, obj: Meal) -> int:
        return 0

    def get_pantry_coverage_pct(self, obj: Meal) -> int | None:
        v = getattr(obj, "_pantry_coverage_pct", None)
        if v is None:
            return None
        return int(v)


class MealImportFromUrlSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2048)


class InstanceSlotSerializer(serializers.Serializer):
    day_index = serializers.IntegerField()
    slot_index = serializers.IntegerField()
    meal_ids = serializers.ListField(child=serializers.IntegerField(), read_only=True)


class MealPlanInstanceSerializer(serializers.ModelSerializer):
    slots = InstanceSlotSerializer(many=True, read_only=True)

    class Meta:
        model = MealPlanInstance
        fields = (
            "id",
            "owner_user",
            "week_start",
            "slots",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_user", "slots", "created_at", "updated_at")


class GroceryListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroceryListItem
        fields = (
            "id",
            "position",
            "display_text",
            "quantity",
            "unit",
            "source_meal",
            "manually_added",
            "ingredient_id",
            "is_checked",
            "contributions",
        )


class IngredientBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ("id", "name", "food_group", "display_emoji", "created_at")
        read_only_fields = ("id", "name", "food_group", "display_emoji", "created_at")


class SavedGroceryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedGroceryList
        fields = ("id", "label", "source_instance", "snapshot", "saved_at")
        read_only_fields = ("id", "saved_at")


class UserIngredientInventorySerializer(serializers.ModelSerializer):
    ingredient = IngredientBriefSerializer(read_only=True)
    pantry_tags = serializers.JSONField(required=False)
    owner_user_id = serializers.IntegerField(read_only=True)
    owner_label = serializers.SerializerMethodField()
    pantry_recommendation_hint = serializers.SerializerMethodField()

    class Meta:
        model = UserIngredientInventory
        fields = (
            "id",
            "ingredient",
            "quantity",
            "simple_have",
            "location",
            "pantry_tags",
            "owner_user_id",
            "owner_label",
            "pantry_recommendation_hint",
        )
        read_only_fields = ("id", "ingredient", "owner_user_id", "owner_label", "pantry_recommendation_hint")

    def get_pantry_recommendation_hint(self, obj: UserIngredientInventory) -> str | None:
        v = getattr(obj, "_pantry_recommendation_hint", None)
        if v in ("not_scheduled", "no_recipes"):
            return v
        return None

    def get_owner_label(self, obj: UserIngredientInventory) -> str:
        request = self.context.get("request")
        if request is None:
            return ""
        from meal.pantry_access import partner_display_label_for_row

        return partner_display_label_for_row(viewer=request.user, row=obj)

    def to_representation(self, instance):
        from meal.pantry_tags import normalize_pantry_tags

        data = super().to_representation(instance)
        data["pantry_tags"] = normalize_pantry_tags(instance.pantry_tags)
        data["owner_user_id"] = instance.owner_user_id
        return data


class GroceryListSerializer(serializers.ModelSerializer):
    items = GroceryListItemSerializer(many=True, read_only=True)

    class Meta:
        model = GroceryList
        fields = ("id", "owner_user", "instance", "items", "hide_checked", "created_at", "updated_at")
        read_only_fields = ("id", "owner_user", "items", "created_at", "updated_at")
