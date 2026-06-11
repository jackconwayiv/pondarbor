from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class Weekday(models.IntegerChoices):
    """Monday=0 … Sunday=6 (matches Python date.weekday())."""

    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class MealPartnerDisconnectRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_disconnect_requests_sent",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_disconnect_requests_received",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipient", "status"]),
            models.Index(fields=["initiator", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.initiator_id}->{self.recipient_id} ({self.status})"


class MealCategoryAxis(models.TextChoices):
    MEAL_TYPE = "meal_type", "Meal type"
    CUISINE = "cuisine", "Cuisine"
    TIME = "time", "Time"


class MealTag(models.Model):
    """Reusable tag string per owner (case-insensitive uniqueness)."""

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_tags",
    )
    name = models.CharField(max_length=120)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "owner_user",
                name="meal_mealtag_owner_name_lower_uniq",
            ),
        ]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class MealCategoryOption(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_category_options",
    )
    axis = models.CharField(max_length=16, choices=MealCategoryAxis.choices, db_index=True)
    name = models.CharField(max_length=120)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "owner_user",
                "axis",
                name="meal_mealcategory_owner_axis_name_lower_uniq",
            ),
        ]
        ordering = ["axis", "name"]

    def __str__(self) -> str:
        return f"{self.axis}:{self.name}"


class Meal(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_meals",
    )
    title = models.CharField(max_length=255, blank=True)
    blurb = models.TextField(blank=True)
    directions = models.TextField(blank=True)
    cloned_from_meal = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clones",
    )
    source_url = models.URLField(max_length=2048, blank=True)
    image_key = models.CharField(max_length=512, blank=True)
    is_published_to_friends = models.BooleanField(default=False, db_index=True)
    meal_type_option = models.ForeignKey(
        MealCategoryOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meals_as_meal_type",
    )
    cuisine_option = models.ForeignKey(
        MealCategoryOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meals_as_cuisine",
    )
    time_option = models.ForeignKey(
        MealCategoryOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meals_as_time",
    )
    tags = models.ManyToManyField(
        MealTag,
        through="MealTagAssignment",
        related_name="meals",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self) -> str:
        t = (self.title or "").strip()
        if t:
            return t[:80]
        return (self.blurb or "Meal")[:80]


class MealTagAssignment(models.Model):
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name="tag_assignments")
    tag = models.ForeignKey(MealTag, on_delete=models.CASCADE, related_name="tag_assignments")

    class Meta:
        unique_together = [("meal", "tag")]


class Ingredient(models.Model):
    """Owner-scoped canonical ingredient for deduplication, grocery merge, search, and pantry."""

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_ingredients_vocab",
    )
    name = models.CharField(max_length=255)
    food_group = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Ingredient category (e.g. Meat, Vegetables); shared across pantry, meals, and grocery.",
    )
    display_emoji = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Optional emoji override for pantry cards; category default when empty.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "owner_user",
                name="meal_ingredient_vocab_owner_name_lower_uniq",
            ),
        ]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class MealIngredient(models.Model):
    meal = models.ForeignKey(
        Meal,
        on_delete=models.CASCADE,
        related_name="ingredients",
    )
    position = models.PositiveSmallIntegerField(default=0)
    raw_line = models.CharField(max_length=512)
    amount = models.CharField(max_length=64, blank=True)
    unit = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255, blank=True)
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meal_lines",
    )

    class Meta:
        ordering = ["position", "id"]
        unique_together = [("meal", "position")]


class MealPlanInstance(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_plan_instances",
    )
    week_start = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-week_start", "-updated_at"]
        unique_together = [("owner_user", "week_start")]

    def __str__(self) -> str:
        return f"{self.owner_user_id} week {self.week_start}"


class MealPlanInstanceSlot(models.Model):
    instance = models.ForeignKey(
        MealPlanInstance,
        on_delete=models.CASCADE,
        related_name="slots",
    )
    day_index = models.PositiveSmallIntegerField()
    slot_index = models.PositiveSmallIntegerField()
    class Meta:
        unique_together = [("instance", "day_index", "slot_index")]


class MealPlanInstanceSlotMeal(models.Model):
    slot = models.ForeignKey(
        MealPlanInstanceSlot,
        on_delete=models.CASCADE,
        related_name="slot_meals",
    )
    meal = models.ForeignKey(
        Meal,
        on_delete=models.CASCADE,
        related_name="instance_slot_links",
    )

    class Meta:
        unique_together = [("slot", "meal")]


class GroceryList(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_grocery_lists",
    )
    instance = models.OneToOneField(
        MealPlanInstance,
        on_delete=models.CASCADE,
        related_name="grocery_list",
    )
    hide_checked = models.BooleanField(
        default=False,
        help_text="UI: hide strikethrough items in the grocery list view.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class GroceryListItem(models.Model):
    grocery_list = models.ForeignKey(
        GroceryList,
        on_delete=models.CASCADE,
        related_name="items",
    )
    position = models.PositiveSmallIntegerField(default=0)
    display_text = models.CharField(max_length=512)
    quantity = models.CharField(max_length=64, blank=True)
    unit = models.CharField(max_length=64, blank=True)
    source_meal = models.ForeignKey(
        Meal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grocery_list_items",
    )
    manually_added = models.BooleanField(default=False)
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grocery_list_items",
    )
    is_checked = models.BooleanField(default=False)
    contributions = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["position", "id"]


class SavedGroceryList(models.Model):
    """Immutable snapshot copied from a generated or edited list."""

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_grocery_lists",
    )
    label = models.CharField(max_length=255, blank=True)
    source_instance = models.ForeignKey(
        MealPlanInstance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="saved_grocery_snapshots",
    )
    snapshot = models.JSONField()
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-saved_at", "-id"]


class UserIngredientInventory(models.Model):
    """Opt-in per-ingredient pantry counts (see Profile.meal_pantry_enabled)."""

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_ingredient_inventory",
    )
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.CASCADE,
        related_name="inventory_rows",
    )
    quantity = models.PositiveIntegerField(default=0)
    simple_have = models.BooleanField(
        null=True,
        blank=True,
        help_text="When set, use quick have/don’t-have instead of quantity.",
    )
    location = models.CharField(max_length=120, blank=True, default="")
    pantry_tags = models.JSONField(
        default=dict,
        blank=True,
        help_text="Tag lists: food_group, storage, preferred_meal, dietary.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("owner_user", "ingredient", "location"),
                name="meal_useringredientinventory_owner_ingredient_location_uniq",
            ),
        ]
