from __future__ import annotations

from rest_framework import serializers

from meal.models import (
    GroceryList,
    GroceryListItem,
    Meal,
    MealPlanInstance,
    MealPlanInstanceSlot,
    MealPlanTemplate,
    MealPlanTemplateSlot,
    Recipe,
    RecipeIngredient,
)


class RecipeIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeIngredient
        fields = ("id", "position", "raw_line", "amount", "unit", "name")


class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)

    class Meta:
        model = Recipe
        fields = (
            "id",
            "owner_user",
            "title",
            "directions",
            "notes",
            "cloned_from_recipe",
            "ingredients",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_user", "cloned_from_recipe", "created_at", "updated_at")


class RecipeWriteSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, required=False)

    class Meta:
        model = Recipe
        fields = ("title", "directions", "notes", "ingredients")

    def create(self, validated_data):
        ingredients_data = validated_data.pop("ingredients", [])
        recipe = Recipe.objects.create(**validated_data)
        for i, row in enumerate(ingredients_data):
            RecipeIngredient.objects.create(
                recipe=recipe,
                position=row.get("position", i),
                raw_line=row.get("raw_line", ""),
                amount=row.get("amount", ""),
                unit=row.get("unit", ""),
                name=row.get("name", ""),
            )
        return recipe

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop("ingredients", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if ingredients_data is not None:
            instance.ingredients.all().delete()
            for i, row in enumerate(ingredients_data):
                RecipeIngredient.objects.create(
                    recipe=instance,
                    position=row.get("position", i),
                    raw_line=row.get("raw_line", ""),
                    amount=row.get("amount", ""),
                    unit=row.get("unit", ""),
                    name=row.get("name", ""),
                )
        return instance


class MealSerializer(serializers.ModelSerializer):
    recipes = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = (
            "id",
            "owner_user",
            "recipes",
            "title",
            "blurb",
            "cloned_from_meal",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_user", "cloned_from_meal", "created_at", "updated_at")

    def get_recipes(self, obj: Meal):
        links = obj.meal_recipes.order_by("position", "id")
        recipe_objs = [link.recipe for link in links]
        return RecipeSerializer(recipe_objs, many=True).data


class MealWriteSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    blurb = serializers.CharField(required=False, allow_blank=True)
    recipe_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class TemplateSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealPlanTemplateSlot
        fields = ("day_index", "slot_index", "meal_id")


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


class InstanceSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealPlanInstanceSlot
        fields = ("day_index", "slot_index", "meal_id")


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
