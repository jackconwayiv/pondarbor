from django.urls import path

from . import views

urlpatterns = [
    path("games/", views.games_collection),
    path("games/<int:game_id>/", views.game_detail),
    path("games/<int:game_id>/actions/end-day/", views.game_end_day),
    path("games/<int:game_id>/actions/patch-world/", views.game_patch_world),
    path("games/<int:game_id>/actions/undo/", views.game_undo),
    path("campaigns/", views.campaigns_create),
    path("campaigns/mine/", views.campaigns_mine),
    path("campaigns/<int:game_id>/", views.campaigns_detail),
    path("campaigns/<int:game_id>/invites/", views.campaigns_invite),
    path("campaigns/<int:game_id>/invites/accept/", views.campaigns_invite_accept),
    path("campaigns/<int:game_id>/invites/decline/", views.campaigns_invite_decline),
    path("campaigns/<int:game_id>/invites/revoke/", views.campaigns_invite_revoke),
    path("campaigns/<int:game_id>/start/", views.campaigns_start),
    path("campaigns/<int:game_id>/invitee-search/", views.campaigns_invitee_search),
]
