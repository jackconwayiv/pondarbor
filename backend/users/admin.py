from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user_email",
        "display_name",
        "status",
        "timezone",
        "created_at",
    )
    list_filter = ("status", "timezone", "created_at")
    search_fields = ("user__email", "display_name", "user__username")

    @admin.display(ordering="user__email", description="Email")
    def user_email(self, obj):
        return obj.user.email
