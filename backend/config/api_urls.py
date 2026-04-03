from django.urls import include, path

urlpatterns = [
    path("users/", include("users.urls")),
    path("quotes/", include("quotes.urls")),
    path("whatif/", include("whatif.urls")),
    path("clicker/", include("clicker.urls")),
    path("achievements/", include("achievements.urls")),
]
