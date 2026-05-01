from django.urls import path

from contact.views import contact_staff_messages, contact_submit

urlpatterns = [
    path("", contact_submit),
    path("staff/messages/", contact_staff_messages),
]
