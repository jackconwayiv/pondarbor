from django.urls import path

from whatiff.views import health

urlpatterns = [
    path("health/", health),
]
