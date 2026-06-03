from django.urls import path

from scorenado import social_views, views

urlpatterns = [
    path("templates/", views.templates_collection),
    path("templates/<uuid:template_id>/", views.templates_detail),
    path("games/", views.games_collection),
    path("games/<uuid:game_id>/", views.games_detail),
    path("games/<uuid:game_id>/finalize/", views.games_finalize),
    path("games/<uuid:game_id>/players/", views.games_players_collection),
    path(
        "games/<uuid:game_id>/players/<uuid:player_id>/",
        views.games_players_detail,
    ),
    path(
        "games/<uuid:game_id>/players/<uuid:player_id>/invite/",
        social_views.games_players_invite,
    ),
    path(
        "games/<uuid:game_id>/players/<uuid:player_id>/cancel-invite/",
        social_views.games_players_cancel_invite,
    ),
    path(
        "games/<uuid:game_id>/players/<uuid:player_id>/unclaim/",
        social_views.games_players_unclaim,
    ),
    path("games/<uuid:game_id>/scores/", views.games_scores_upsert),
    path("games/<uuid:game_id>/tags/", social_views.games_tags_collection),
    path(
        "games/<uuid:game_id>/tags/<uuid:tag_id>/",
        social_views.games_tags_detail,
    ),
    path("invites/pending/", social_views.invites_pending),
    path("invites/<uuid:player_id>/accept/", social_views.invites_accept),
    path("invites/<uuid:player_id>/reject/", social_views.invites_reject),
    path("stats/", social_views.stats_summary),
]
