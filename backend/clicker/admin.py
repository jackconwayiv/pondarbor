from django.contrib import admin

from .models import ClickerGameSave


@admin.register(ClickerGameSave)
class ClickerGameSaveAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "schema_version", "last_played_at", "updated_at")
    list_filter = ("schema_version",)
    search_fields = ("user__email",)
    readonly_fields = ("created_at", "updated_at", "last_played_at")
