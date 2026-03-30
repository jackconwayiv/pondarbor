from django.urls import include, path

urlpatterns = [
    path("users/", include("users.urls")),
    path("quotes/", include("quotes.urls")),
    path("whatiff/", include("whatiff.urls")),
]
