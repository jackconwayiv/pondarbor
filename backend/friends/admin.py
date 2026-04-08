from django.contrib import admin

from friends.models import FriendRequest


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "requester",
        "requested",
        "is_accepted",
        "ignored_by_requester",
        "ignored_by_requested",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "is_accepted",
        "ignored_by_requester",
        "ignored_by_requested",
        "created_at",
    )
    search_fields = (
        "requester__email",
        "requested__email",
    )
    raw_id_fields = ("requester", "requested")
    readonly_fields = ("created_at", "updated_at")
