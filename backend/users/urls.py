from django.urls import path

from users.views import (
    approved_check,
    csrf,
    health,
    login_view,
    logout_view,
    me,
    patch_me_profile,
    signup,
    sync_profile,
)
from quotes.views import user_public_quotes

urlpatterns = [
    path("health/", health),
    path("csrf/", csrf),
    path("me/", me),
    path("me/profile/", patch_me_profile),
    path("approved-check/", approved_check),
    path("signup/", signup),
    path("login/", login_view),
    path("logout/", logout_view),
    path("sync-profile/", sync_profile),
    path("<str:email>/public-quotes/", user_public_quotes),
]
