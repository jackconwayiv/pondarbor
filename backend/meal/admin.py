from django.contrib import admin

from meal.models import (
    GroceryList,
    GroceryListItem,
    Ingredient,
    Meal,
    MealCategoryOption,
    MealIngredient,
    MealPartnerDisconnectRequest,
    MealPlanInstance,
    MealPlanInstanceSlot,
    MealPlanInstanceSlotMeal,
    MealPlanTemplate,
    MealPlanTemplateSlot,
    MealPlanTemplateSlotMeal,
    MealTag,
    MealTagAssignment,
    SavedGroceryList,
    UserIngredientInventory,
)


@admin.register(MealPartnerDisconnectRequest)
class MealPartnerDisconnectRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "initiator", "recipient", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("initiator__email", "recipient__email")
    raw_id_fields = ("initiator", "recipient")
    readonly_fields = ("created_at", "updated_at")


@admin.register(MealTag)
class MealTagAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "name")
    search_fields = ("name", "owner_user__email")
    autocomplete_fields = ("owner_user",)


@admin.register(MealCategoryOption)
class MealCategoryOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "axis", "name")
    list_filter = ("axis",)
    search_fields = ("name", "owner_user__email")
    autocomplete_fields = ("owner_user",)


@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner_user", "is_published_to_friends", "updated_at")
    list_filter = ("is_published_to_friends",)
    search_fields = ("title", "blurb", "owner_user__email")
    raw_id_fields = (
        "owner_user",
        "cloned_from_meal",
        "meal_type_option",
        "cuisine_option",
        "time_option",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(MealTagAssignment)
class MealTagAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "meal", "tag")
    autocomplete_fields = ("meal", "tag")


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "name")
    search_fields = ("name", "owner_user__email")
    autocomplete_fields = ("owner_user",)


@admin.register(MealIngredient)
class MealIngredientAdmin(admin.ModelAdmin):
    list_display = ("id", "meal", "position", "raw_line", "ingredient")
    search_fields = ("raw_line", "name", "meal__title", "meal__owner_user__email")
    raw_id_fields = ("meal", "ingredient")
    ordering = ("meal_id", "position", "id")


@admin.register(MealPlanTemplate)
class MealPlanTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner_user", "slots_per_day", "updated_at")
    search_fields = ("name", "description", "owner_user__email")
    raw_id_fields = ("owner_user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(MealPlanTemplateSlot)
class MealPlanTemplateSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "template", "day_index", "slot_index")
    raw_id_fields = ("template",)


@admin.register(MealPlanTemplateSlotMeal)
class MealPlanTemplateSlotMealAdmin(admin.ModelAdmin):
    list_display = ("id", "slot", "meal")
    raw_id_fields = ("slot", "meal")


@admin.register(MealPlanInstance)
class MealPlanInstanceAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "week_start", "source_template", "updated_at")
    list_filter = ("week_start",)
    search_fields = ("owner_user__email",)
    raw_id_fields = ("owner_user", "source_template")
    readonly_fields = ("created_at", "updated_at")


@admin.register(MealPlanInstanceSlot)
class MealPlanInstanceSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "instance", "day_index", "slot_index")
    raw_id_fields = ("instance",)


@admin.register(MealPlanInstanceSlotMeal)
class MealPlanInstanceSlotMealAdmin(admin.ModelAdmin):
    list_display = ("id", "slot", "meal")
    raw_id_fields = ("slot", "meal")


@admin.register(GroceryList)
class GroceryListAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "instance", "updated_at")
    search_fields = ("owner_user__email",)
    raw_id_fields = ("owner_user", "instance")
    readonly_fields = ("created_at", "updated_at")


@admin.register(GroceryListItem)
class GroceryListItemAdmin(admin.ModelAdmin):
    list_display = ("id", "grocery_list", "position", "display_text", "manually_added", "is_checked")
    list_filter = ("manually_added", "is_checked")
    search_fields = ("display_text", "grocery_list__owner_user__email")
    raw_id_fields = ("grocery_list", "source_meal", "ingredient")


@admin.register(SavedGroceryList)
class SavedGroceryListAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "label", "source_instance", "saved_at")
    search_fields = ("label", "owner_user__email")
    raw_id_fields = ("owner_user", "source_instance")
    readonly_fields = ("saved_at",)


@admin.register(UserIngredientInventory)
class UserIngredientInventoryAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "ingredient", "quantity", "simple_have")
    search_fields = ("ingredient__name", "owner_user__email")
    raw_id_fields = ("owner_user", "ingredient")
