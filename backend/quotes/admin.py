from django.contrib import admin
from django.contrib.admin import EmptyFieldListFilter

from quotes.models import Quote, QuoteLabel, QuoteLabelAssignment


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "body_preview",
        "visibility",
        "date_of_quote",
        "deleted_at",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "visibility",
        ("deleted_at", EmptyFieldListFilter),
        "created_at",
    )
    search_fields = ("body", "owner__email")
    raw_id_fields = ("owner",)
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Body")
    def body_preview(self, obj: Quote) -> str:
        text = (obj.body or "").strip()
        if len(text) <= 60:
            return text
        return f"{text[:57]}…"


@admin.register(QuoteLabel)
class QuoteLabelAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "kind",
        "name",
        "linked_user",
        "created_at",
        "updated_at",
    )
    list_filter = ("kind", "created_at")
    search_fields = ("name", "owner__email")
    raw_id_fields = ("owner", "linked_user")
    readonly_fields = ("created_at", "updated_at")


@admin.register(QuoteLabelAssignment)
class QuoteLabelAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "quote", "label", "created_at")
    list_filter = ("created_at",)
    search_fields = ("quote__body", "label__name")
    raw_id_fields = ("quote", "label")
    readonly_fields = ("created_at",)
