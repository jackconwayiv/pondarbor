from django.urls import path

from .consumers import EstatesGameConsumer, EstatesLobbiesConsumer

websocket_urlpatterns = [
    path("api/v1/estates/ws/lobbies/", EstatesLobbiesConsumer.as_asgi()),
    path("api/v1/estates/ws/game/<uuid:game_id>/", EstatesGameConsumer.as_asgi()),
]

