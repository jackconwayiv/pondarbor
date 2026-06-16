from django.conf import settings
from django.db import models

from recommendations.constants import CategoryGroup


class RecommendationCategory(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    emoji = models.CharField(max_length=16, blank=True)
    group = models.CharField(
        max_length=16,
        choices=CategoryGroup.choices,
        default=CategoryGroup.MEDIA,
        db_index=True,
    )
    is_preset = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recommendation_categories_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["group", "name"]
        verbose_name_plural = "recommendation categories"

    def __str__(self) -> str:
        return self.name


class Entry(models.Model):
    category = models.ForeignKey(
        RecommendationCategory,
        on_delete=models.PROTECT,
        related_name="entries",
    )
    title = models.CharField(max_length=512)
    link = models.URLField(max_length=2048, blank=True)
    link_normalized = models.CharField(max_length=2048, blank=True, db_index=True)
    image_url = models.URLField(max_length=2048, blank=True)
    creator = models.CharField(max_length=256, blank=True)
    media_source = models.CharField(max_length=256, blank=True)
    address = models.CharField(max_length=512, blank=True)
    location_label = models.CharField(max_length=128, blank=True)
    google_place_id = models.CharField(max_length=256, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommendation_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "entries"
        constraints = [
            models.UniqueConstraint(
                fields=["link_normalized"],
                condition=models.Q(link_normalized__gt=""),
                name="uniq_entry_link_normalized",
            ),
            models.UniqueConstraint(
                fields=["google_place_id"],
                condition=models.Q(google_place_id__gt=""),
                name="uniq_entry_google_place_id",
            ),
        ]
        indexes = [
            models.Index(fields=["category", "-updated_at"]),
        ]

    def __str__(self) -> str:
        return self.title


class Review(models.Model):
    entry = models.ForeignKey(
        Entry,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommendation_reviews",
    )
    rating = models.DecimalField(max_digits=4, decimal_places=2)
    body = models.TextField()
    date_recommended = models.DateField()
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "reviewer"],
                condition=models.Q(deleted_at__isnull=True),
                name="uniq_active_review_per_reviewer",
            ),
        ]
        indexes = [
            models.Index(fields=["entry", "-created_at"]),
            models.Index(fields=["reviewer", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Review {self.id} on {self.entry_id}"
