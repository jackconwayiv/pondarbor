from django.urls import path

from goals import views

urlpatterns = [
    path("dashboard/", views.goals_dashboard),
    path("reset/", views.goals_reset),
    path("", views.goals_collection),
    path("<uuid:goal_id>/", views.goals_detail),
    path("<uuid:goal_id>/check-ins/", views.goals_check_in),
    path("<uuid:goal_id>/undo/", views.goals_undo),
    path("<uuid:goal_id>/checkpoints/", views.goals_checkpoints_collection),
    path(
        "<uuid:goal_id>/checkpoints/<uuid:checkpoint_id>/",
        views.goals_checkpoint_detail,
    ),
]
