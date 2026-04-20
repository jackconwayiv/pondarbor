from django.contrib import admin

from calendars.models import CalendarSource, Event


@admin.register(CalendarSource)
class CalendarSourceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "source_type",
        "display_name",
        "is_active",
        "last_synced_at",
        "last_error",
    )
    list_filter = ("source_type", "is_active")
    search_fields = ("owner__email", "display_name", "ical_url")
    readonly_fields = ("last_synced_at", "last_etag", "last_modified_header", "last_error")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "title", "start_at", "end_at", "all_day", "source")
    list_filter = ("all_day",)
    search_fields = ("title", "owner__email", "external_uid")
    date_hierarchy = "start_at"
