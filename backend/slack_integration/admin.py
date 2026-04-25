from django.contrib import admin

from slack_integration.models import SlackIdentity, SongadaySlackDailyPromptState


@admin.register(SlackIdentity)
class SlackIdentityAdmin(admin.ModelAdmin):
    list_display = ("id", "team_id", "slack_user_id", "user", "updated_at")
    search_fields = ("team_id", "slack_user_id", "user__email")


@admin.register(SongadaySlackDailyPromptState)
class SongadaySlackDailyPromptStateAdmin(admin.ModelAdmin):
    list_display = ("id", "last_posted_on")
