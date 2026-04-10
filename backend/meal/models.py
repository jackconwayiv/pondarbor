from django.conf import settings
from django.db import models


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


class Recipe(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_recipes",
    )
    title = models.CharField(max_length=255)
    directions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    cloned_from_recipe = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clones",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self) -> str:
        return self.title


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="ingredients",
    )
    position = models.PositiveSmallIntegerField(default=0)
    raw_line = models.CharField(max_length=512)
    amount = models.CharField(max_length=64, blank=True)
    unit = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["position", "id"]
        unique_together = [("recipe", "position")]


class Meal(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_meals",
    )
    title = models.CharField(max_length=255, blank=True)
    blurb = models.TextField(blank=True)
    cloned_from_meal = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clones",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self) -> str:
        t = (self.title or "").strip()
        if t:
            return t[:80]
        titles = [mr.recipe.title for mr in self.meal_recipes.order_by("position", "id").select_related("recipe")]
        if titles:
            return ", ".join(titles)[:80]
        return (self.blurb or "Meal")[:80]


class MealRecipe(models.Model):
    """Ordered link from a meal to one or more recipes."""

    meal = models.ForeignKey(
        Meal,
        on_delete=models.CASCADE,
        related_name="meal_recipes",
    )
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="meal_links",
    )
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        unique_together = [("meal", "recipe")]

    def __str__(self) -> str:
        return f"{self.meal_id} → {self.recipe_id}"


class MealPlanTemplate(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_plan_templates",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    slots_per_day = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self) -> str:
        return self.name


class MealPlanTemplateSlot(models.Model):
    template = models.ForeignKey(
        MealPlanTemplate,
        on_delete=models.CASCADE,
        related_name="slots",
    )
    day_index = models.PositiveSmallIntegerField()
    slot_index = models.PositiveSmallIntegerField()
    meal = models.ForeignKey(
        Meal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="template_slots",
    )

    class Meta:
        unique_together = [("template", "day_index", "slot_index")]


class MealPlanInstance(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_plan_instances",
    )
    source_template = models.ForeignKey(
        MealPlanTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances",
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
    meal = models.ForeignKey(
        Meal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instance_slots",
    )

    class Meta:
        unique_together = [("instance", "day_index", "slot_index")]


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

    class Meta:
        ordering = ["position", "id"]
