from django.urls import path

from whatif.consumers import WhatIfSessionConsumer

websocket_urlpatterns = [
    path(
        "api/v1/whatif/ws/session/<str:code>/",
        WhatIfSessionConsumer.as_asgi(),
    ),
]
