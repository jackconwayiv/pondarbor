from django.urls import path

from achievements.views import health, staff_achievement_definitions

urlpatterns = [
    path("health/", health),
    path("definitions/", staff_achievement_definitions),
]
