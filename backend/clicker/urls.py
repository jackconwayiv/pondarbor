from django.urls import path

from clicker.views import game_state, health

urlpatterns = [
    path("health/", health),
    path("state/", game_state),
]
