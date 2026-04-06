from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Profile, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "first_name",
        "last_name",
        "account_status",
        "deleted_at",
        "is_staff",
        "is_active",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "account_status")
    search_fields = ("email", "first_name", "last_name", "auth0_sub")
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Identity", {"fields": ("auth0_sub", "account_status", "deleted_at")}),
        ("Names", {"fields": ("first_name", "last_name", "username")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user_email",
        "display_name",
        "user_account_status",
        "timezone",
        "created_at",
    )
    list_filter = ("timezone", "created_at")
    search_fields = ("user__email", "display_name")

    @admin.display(ordering="user__email", description="Email")
    def user_email(self, obj):
        return obj.user.email

    @admin.display(ordering="user__account_status", description="Account status")
    def user_account_status(self, obj):
        return obj.user.account_status
