from django.contrib import admin
from django.urls import include, path

from users.frontend_views import spa_index

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/v1/", include("config.api_urls")),
    path("users/", include("users.urls")),
    path("", spa_index),
]
