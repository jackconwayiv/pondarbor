from django.urls import include, path

urlpatterns = [
    path("contact/", include("contact.urls")),
    path("users/", include("users.urls")),
    path("quotes/", include("quotes.urls")),
    path("friends/", include("friends.urls")),
    path("whatif/", include("whatif.urls")),
    path("clicker/", include("clicker.urls")),
    path("achievements/", include("achievements.urls")),
    path("qff/", include("qff.urls")),
    path("closet/", include("closet.urls")),
]
