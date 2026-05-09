from django.urls import path

from zodiac.views import (
    staff_imported_charts,
    staff_pending_charts,
    staff_user_chart,
    user_astro_profile,
)

urlpatterns = [
    path("profile/", user_astro_profile),
    path("staff/pending/", staff_pending_charts),
    path("staff/imported/", staff_imported_charts),
    path("staff/users/<int:user_id>/chart/", staff_user_chart),
]
