from django.urls import path

from clicker.views import clicker2_game_state

urlpatterns = [
    path("state/", clicker2_game_state),
]
