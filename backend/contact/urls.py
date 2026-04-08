from django.urls import path

from contact.views import contact_submit

urlpatterns = [
    path("", contact_submit),
]
