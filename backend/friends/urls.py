from django.urls import path

from friends.views import (
    accept_friend,
    approved_users_list,
    approved_users_search,
    friends_list,
    friends_search,
    ignore_friend,
    request_friend,
    request_friend_by_id,
    unfriend,
)

urlpatterns = [
    path("", friends_list),
    path("request/", request_friend),
    path("<int:user_id>/request/", request_friend_by_id),
    path("search/", friends_search),
    path("approved-users/", approved_users_list),
    path("approved-users/search/", approved_users_search),
    path("<int:user_id>/accept/", accept_friend),
    path("<int:user_id>/ignore/", ignore_friend),
    path("<int:user_id>/unfriend/", unfriend),
]

