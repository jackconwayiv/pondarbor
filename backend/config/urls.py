from django.contrib import admin
from django.urls import include, path
from users.frontend_views import spa_index
from users.views import (
    approved_check,
    csrf,
    health,
    login_view,
    logout_view,
    me,
    signup,
    sync_profile,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("users/health/", health),
    path("users/csrf/", csrf),
    path("users/me/", me),
    path("users/approved-check/", approved_check),
    path("users/signup/", signup),
    path("users/login/", login_view),
    path("users/logout/", logout_view),
    path("users/sync-profile/", sync_profile),
    path("", spa_index),
]
