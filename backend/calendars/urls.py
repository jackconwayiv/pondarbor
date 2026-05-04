from django.urls import path

from calendars.views import (
    approved_users_list,
    calendar_bootstrap,
    calendar_sync_refresh,
    event_detail,
    events_list,
    source_detail,
    sources_list,
)

urlpatterns = [
    path("bootstrap/", calendar_bootstrap),
    path("sync-refresh/", calendar_sync_refresh),
    path("events/", events_list),
    path("events/<int:event_id>/", event_detail),
    path("sources/", sources_list),
    path("sources/<int:source_id>/", source_detail),
    path("approved-users/", approved_users_list),
]
