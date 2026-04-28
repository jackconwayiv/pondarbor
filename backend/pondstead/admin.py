from django.contrib import admin

from .models import PondsteadCampaignInvite, PondsteadDayLog, PondsteadGame, PondsteadGameState, PondsteadPlayer


@admin.register(PondsteadGame)
class PondsteadGameAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "owner_id", "max_players", "current_day", "updated_at")


@admin.register(PondsteadCampaignInvite)
class PondsteadCampaignInviteAdmin(admin.ModelAdmin):
    list_display = ("id", "game_id", "invitee_id", "status", "created_at")


@admin.register(PondsteadPlayer)
class PondsteadPlayerAdmin(admin.ModelAdmin):
    list_display = ("id", "game_id", "seat_index", "display_name", "points")


@admin.register(PondsteadGameState)
class PondsteadGameStateAdmin(admin.ModelAdmin):
    list_display = ("id", "game_id", "revision", "created_at")


@admin.register(PondsteadDayLog)
class PondsteadDayLogAdmin(admin.ModelAdmin):
    list_display = ("id", "game_id", "day", "created_at")
