from django.urls import path

from slack_integration.views import songaday_slack_daily_prompt_sync
from songaday.playlist_month import playlists_browse, playlists_month
from songaday.views import (
    day_window,
    health,
    prompt_for_date,
    prompts_bulk_import,
    prompts_list,
    resolve_song_link,
    response_create,
    response_detail,
    response_heart_toggle,
    responses_archive,
    responses_archive_eligible_friends,
    responses_for_date,
)

urlpatterns = [
    path("health/", health),
    path("slack/daily-prompt-sync/", songaday_slack_daily_prompt_sync),
    path("prompts/list/", prompts_list),
    path("prompts/catalog/", prompts_list),
    path("prompts/for-date/", prompt_for_date),
    path("day-window/", day_window),
    path("prompts/bulk-import/", prompts_bulk_import),
    path("resolve-link/", resolve_song_link),
    path("responses/for-date/", responses_for_date),
    path("responses/archive/eligible-friends/", responses_archive_eligible_friends),
    path("responses/archive/", responses_archive),
    path("playlists/browse/", playlists_browse),
    path("playlists/month/", playlists_month),
    path("responses/", response_create),
    path("responses/<int:response_id>/", response_detail),
    path("responses/<int:response_id>/heart/", response_heart_toggle),
]
