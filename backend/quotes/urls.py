from django.urls import path

from quotes.views import health

urlpatterns = [
    path("health/", health),
]
