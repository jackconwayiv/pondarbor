from django.urls import path

from achievements.views import health

urlpatterns = [
    path("health/", health),
]
