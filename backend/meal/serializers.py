from __future__ import annotations

from rest_framework import serializers

from meal.models import (
    GroceryList,
    GroceryListItem,
    Meal,
    MealIngredient,
    MealPlanInstance,
    MealPlanTemplate,
)


class MealIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealIngredient
        fields = ("id", "position", "raw_line", "amount", "unit", "name")


class MealSerializer(serializers.ModelSerializer):
    ingredients = MealIngredientSerializer(many=True, read_only=True)

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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_user", "cloned_from_meal", "created_at", "updated_at")


class MealWriteSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    blurb = serializers.CharField(required=False, allow_blank=True)
    directions = serializers.CharField(required=False, allow_blank=True)
    ingredients = MealIngredientSerializer(many=True, required=False)


class TemplateSlotSerializer(serializers.Serializer):
    day_index = serializers.IntegerField()
    slot_index = serializers.IntegerField()
    meal_ids = serializers.ListField(child=serializers.IntegerField(), read_only=True)


class MealPlanTemplateSerializer(serializers.ModelSerializer):
    slots = TemplateSlotSerializer(many=True, read_only=True)

    class Meta:
        model = MealPlanTemplate
        fields = (
            "id",
            "owner_user",
            "name",
            "description",
            "slots_per_day",
            "slots",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_user", "slots", "created_at", "updated_at")


class MealPlanTemplateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealPlanTemplate
        fields = ("name", "description", "slots_per_day")

    def validate_slots_per_day(self, value: int) -> int:
        if value < 1 or value > 5:
            raise serializers.ValidationError("slots_per_day must be between 1 and 5.")
        return value


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
            "source_template",
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
        )


class GroceryListSerializer(serializers.ModelSerializer):
    items = GroceryListItemSerializer(many=True, read_only=True)

    class Meta:
        model = GroceryList
        fields = ("id", "owner_user", "instance", "items", "created_at", "updated_at")
        read_only_fields = ("id", "owner_user", "items", "created_at", "updated_at")
