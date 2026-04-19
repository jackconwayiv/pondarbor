from django.urls import path

from qff.consumers import QffSessionConsumer

websocket_urlpatterns = [
    path("api/v1/qff/ws/session/", QffSessionConsumer.as_asgi()),
]
