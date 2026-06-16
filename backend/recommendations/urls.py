from django.urls import path

from recommendations.views import (
    categories_list,
    category_entries,
    entries_geo,
    entry_create,
    entry_detail,
    entry_review_create,
    group_entries,
    health,
    resolve_link,
    review_detail,
    reviews_friend_owner,
    reviews_mine,
)

urlpatterns = [
    path("health/", health),
    path("categories/", categories_list),
    path("categories/<slug:category_slug>/entries/", category_entries),
    path("groups/<slug:group>/entries/", group_entries),
    path("entries/geo/", entries_geo),
    path("entries/", entry_create),
    path("entries/<int:entry_id>/", entry_detail),
    path("entries/<int:entry_id>/reviews/", entry_review_create),
    path("reviews/mine/", reviews_mine),
    path("reviews/friends/<int:owner_user_id>/", reviews_friend_owner),
    path("reviews/<int:review_id>/", review_detail),
    path("resolve-link/", resolve_link),
]
