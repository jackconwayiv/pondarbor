from django.contrib import admin

from slack_integration.models import SlackIdentity, SlackSongadayIngestTrace, SongadaySlackDailyPromptState


@admin.register(SlackIdentity)
class SlackIdentityAdmin(admin.ModelAdmin):
    list_display = ("id", "team_id", "slack_user_id", "user", "updated_at")
    search_fields = ("team_id", "slack_user_id", "user__email")


@admin.register(SlackSongadayIngestTrace)
class SlackSongadayIngestTraceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "created_at",
        "outcome",
        "team_id",
        "channel_id",
        "slack_user_id",
        "user",
        "song_response_id",
        "extracted_url",
    )
    list_filter = ("outcome", "team_id", "channel_id")
    search_fields = (
        "event_id",
        "slack_user_id",
        "team_id",
        "channel_id",
        "extracted_url",
        "raw_text",
        "user__email",
    )
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(SongadaySlackDailyPromptState)
class SongadaySlackDailyPromptStateAdmin(admin.ModelAdmin):
    list_display = ("id", "last_posted_on")
