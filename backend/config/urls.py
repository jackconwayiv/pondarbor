from django.contrib import admin
from django.urls import path
from users.frontend_views import spa_index
from users.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("users/health/", health),
    path("", spa_index),
]
