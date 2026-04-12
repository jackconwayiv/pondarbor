from django.urls import path

from songaday.views import (
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
    path("prompts/list/", prompts_list),
    path("prompts/catalog/", prompts_list),
    path("prompts/for-date/", prompt_for_date),
    path("prompts/bulk-import/", prompts_bulk_import),
    path("resolve-link/", resolve_song_link),
    path("responses/for-date/", responses_for_date),
    path("responses/archive/eligible-friends/", responses_archive_eligible_friends),
    path("responses/archive/", responses_archive),
    path("responses/", response_create),
    path("responses/<int:response_id>/", response_detail),
    path("responses/<int:response_id>/heart/", response_heart_toggle),
]
