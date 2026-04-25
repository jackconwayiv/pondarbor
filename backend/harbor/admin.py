from django.contrib import admin

from .models import (
    HARBOR_DEF_MODELS,
    HarborCatalogVersion,
    HarborGameSave,
)


@admin.register(HarborGameSave)
class HarborGameSaveAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "schema_version",
        "catalog_version",
        "last_played_at",
        "updated_at",
    )
    list_filter = ("schema_version",)
    search_fields = ("user__email",)
    readonly_fields = ("created_at", "updated_at", "last_played_at")


@admin.register(HarborCatalogVersion)
class HarborCatalogVersionAdmin(admin.ModelAdmin):
    list_display = ("id", "version", "updated_at")
    readonly_fields = ("updated_at",)


class _HarborDefAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "stage_min", "stage_max", "enabled", "sort_order", "updated_at")
    list_filter = ("enabled", "stage_min")
    search_fields = ("slug", "name")
    ordering = ("sort_order", "slug")
    readonly_fields = ("created_at", "updated_at")


for _model in HARBOR_DEF_MODELS:
    admin.site.register(_model, _HarborDefAdmin)
