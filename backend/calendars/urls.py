from django.urls import path

from calendars.views import (
    approved_users_list,
    event_detail,
    events_list,
    source_detail,
    sources_list,
)

urlpatterns = [
    path("events/", events_list),
    path("events/<int:event_id>/", event_detail),
    path("sources/", sources_list),
    path("sources/<int:source_id>/", source_detail),
    path("approved-users/", approved_users_list),
]
