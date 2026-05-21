from django.urls import path

from . import views

urlpatterns = [
    path("lobbies/", views.lobbies_collection),
    path("lobbies/solo/", views.lobby_solo),
    path("games/mine/", views.games_mine),
    path("games/mine/list/", views.list_my_games),
    path("stats/mine/", views.stats_mine),
    path("games/<uuid:game_id>/actions/place-card/", views.game_place_card),
    path("games/<uuid:game_id>/actions/reorder-hand/", views.game_reorder_hand),
    path("games/<uuid:game_id>/actions/clear-staged-card/", views.game_clear_staged_card),
    path("games/<uuid:game_id>/actions/confirm-card/", views.game_confirm_card),
    path("games/<uuid:game_id>/actions/choose-effect-target/", views.game_choose_effect_target),
    path("games/<uuid:game_id>/actions/concede/", views.game_concede),
    path("lobbies/<uuid:game_id>/", views.lobby_detail),
    path("lobbies/<uuid:game_id>/join/", views.lobby_join),
    path("lobbies/<uuid:game_id>/leave/", views.lobby_leave),
    path("lobbies/<uuid:game_id>/confirm/", views.lobby_confirm),
]

