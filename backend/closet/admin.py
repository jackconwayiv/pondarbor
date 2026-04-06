"""Closet admin is inspection / support only: no hard-deletes (API uses soft-delete for items)."""

from django.contrib import admin
from django.contrib.admin import EmptyFieldListFilter

from closet.models import BorrowRequest, Item, Loan


class _NoDeleteModelAdmin(admin.ModelAdmin):
    """Prevent admin bulk or single-object DELETE from emptying closet tables."""

    actions = None

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Item)
class ItemAdmin(_NoDeleteModelAdmin):
    list_display = (
        "id",
        "name",
        "owner_user",
        "current_holder_user",
        "category",
        "custody_disputed",
        "deleted_at",
        "updated_at",
    )
    list_filter = (
        "custody_disputed",
        ("deleted_at", EmptyFieldListFilter),
    )
    search_fields = (
        "name",
        "description",
        "category",
        "owner_user__email",
        "current_holder_user__email",
    )
    raw_id_fields = (
        "owner_user",
        "current_holder_user",
        "custody_pending_acceptance_user",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(BorrowRequest)
class BorrowRequestAdmin(_NoDeleteModelAdmin):
    list_display = (
        "id",
        "item",
        "requester_user",
        "status",
        "date_needed_by",
        "deleted_at",
        "created_at",
        "responded_at",
    )
    list_filter = ("status", ("deleted_at", EmptyFieldListFilter))
    search_fields = ("item__name", "requester_user__email", "message")
    raw_id_fields = ("item", "requester_user")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Loan)
class LoanAdmin(_NoDeleteModelAdmin):
    list_display = (
        "id",
        "item",
        "owner_user",
        "borrower_user",
        "status",
        "deleted_at",
        "checkout_at",
        "returned_at",
    )
    list_filter = ("status", ("deleted_at", EmptyFieldListFilter))
    search_fields = ("item__name", "owner_user__email", "borrower_user__email")
    raw_id_fields = ("item", "owner_user", "borrower_user", "approved_request")
    readonly_fields = ("checkout_at",)
