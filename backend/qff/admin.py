from django.contrib import admin

from qff.models import (
    Area,
    AreaCell,
    Character,
    CharacterClass,
    CharacterExitSeen,
    CharacterRoomVisit,
    Room,
    RoomExit,
)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "grid_width", "grid_height", "is_dark_minimap")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "area",
        "permanent_minimap_light",
        "reset_dark_lighting_on_enter",
    )
    list_filter = ("area", "permanent_minimap_light", "reset_dark_lighting_on_enter")


@admin.register(AreaCell)
class AreaCellAdmin(admin.ModelAdmin):
    list_display = ("id", "area", "x", "y", "room")


@admin.register(RoomExit)
class RoomExitAdmin(admin.ModelAdmin):
    list_display = ("id", "from_room", "direction", "to_room")


@admin.register(CharacterClass)
class CharacterClassAdmin(admin.ModelAdmin):
    list_display = ("id", "slug", "name", "sort_order", "priority_stat_1", "priority_stat_2")
    search_fields = ("slug", "name")


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "user",
        "current_room",
        "spawn_room",
        "last_activity_at",
    )


@admin.register(CharacterRoomVisit)
class CharacterRoomVisitAdmin(admin.ModelAdmin):
    list_display = ("id", "character", "room")


@admin.register(CharacterExitSeen)
class CharacterExitSeenAdmin(admin.ModelAdmin):
    list_display = ("id", "character", "room_exit")
