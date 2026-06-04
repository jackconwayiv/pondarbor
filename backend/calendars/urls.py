from django.urls import path

from calendars.feed_views import (
    calendar_feed_ics,
    calendar_feed_manage,
    calendar_feed_reset,
)
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
    path("feed/", calendar_feed_manage),
    path("feed/reset/", calendar_feed_reset),
    path("feed/<slug:token>.ics", calendar_feed_ics),
    path("events/", events_list),
    path("events/<int:event_id>/", event_detail),
    path("sources/", sources_list),
    path("sources/<int:source_id>/", source_detail),
    path("approved-users/", approved_users_list),
]
