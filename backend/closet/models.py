from django.conf import settings
from django.db import models


class Item(models.Model):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_owned_items",
    )
    current_holder_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_held_items",
    )
    custody_pending_acceptance_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closet_custody_pending_items",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)
    tags = models.JSONField(default=list, blank=True)
    image_key = models.CharField(max_length=512, blank=True)
    custody_disputed = models.BooleanField(default=False)
    custody_marked_returned_by_holder_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["owner_user", "-updated_at"]),
            models.Index(fields=["owner_user", "-created_at"]),
            models.Index(fields=["current_holder_user", "-updated_at"]),
            models.Index(fields=["custody_pending_acceptance_user", "-updated_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class BorrowRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Declined"
        CANCELED = "canceled", "Canceled"
        FULFILLED = "fulfilled", "Fulfilled"

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="borrow_requests")
    requester_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_borrow_requests",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    date_needed_by = models.DateField()
    message = models.TextField(blank=True)
    decline_message = models.TextField(blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "date_needed_by", "-created_at"]
        indexes = [
            models.Index(fields=["item", "status", "deleted_at"]),
            models.Index(fields=["requester_user", "status", "deleted_at"]),
        ]


class ItemHidden(models.Model):
    """Per-user 'hide this item from my browse grid' marker.

    Hidden items are still returned by browse APIs (so the client can toggle
    'Show Hidden' without a refetch). The frontend filters them out by default.
    Hiding is restricted server-side to items with no active relationship to
    the user (not owner, not borrower, not pending custody recipient, no
    pending/declined borrow request).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_hidden_items",
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="hidden_by_users")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "item")]
        indexes = [models.Index(fields=["user", "item"])]


class Loan(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RETURNED = "returned", "Returned"
        CANCELED = "canceled", "Canceled"

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="loans")
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_owner_loans",
    )
    borrower_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="closet_borrower_loans",
    )
    approved_request = models.ForeignKey(
        BorrowRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_loans",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    checkout_at = models.DateTimeField(auto_now_add=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    marked_returned_by_borrower_at = models.DateTimeField(null=True, blank=True)
    marked_returned_by_owner_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-checkout_at"]
        indexes = [
            models.Index(fields=["item", "status", "deleted_at"]),
            models.Index(fields=["owner_user", "status", "deleted_at"]),
            models.Index(fields=["borrower_user", "status", "deleted_at"]),
        ]

