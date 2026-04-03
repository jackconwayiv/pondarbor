from django.contrib import admin

from achievements.models import AchievementDefinition, UserAchievement


@admin.register(AchievementDefinition)
class AchievementDefinitionAdmin(admin.ModelAdmin):
    list_display = ("slug", "title", "category", "order", "is_active", "display_group", "show_on_public_profile")
    list_filter = ("is_active", "category", "show_on_public_profile")
    search_fields = ("slug", "title", "description")
    ordering = ("order", "slug")


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ("user", "achievement", "unlocked_at")
    list_filter = ("achievement",)
    search_fields = ("user__email", "achievement__slug")
    raw_id_fields = ("user", "achievement")
    readonly_fields = ("unlocked_at",)
