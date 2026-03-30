from django.contrib import admin
from django.urls import include, path

from users.frontend_views import (
    redirect_favicon_svg,
    redirect_icons_svg,
    redirect_pondarbor_logo_png,
    spa_index,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/v1/", include("config.api_urls")),
    path("users/", include("users.urls")),
    path("favicon.svg", redirect_favicon_svg),
    path("pondarborlogo.png", redirect_pondarbor_logo_png),
    path("icons.svg", redirect_icons_svg),
    path("", spa_index),
]
