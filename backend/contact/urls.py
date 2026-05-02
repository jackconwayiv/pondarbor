from django.urls import path

from contact.views import (
    contact_staff_message_delete,
    contact_staff_messages,
    contact_staff_messages_acknowledge,
    contact_submit,
)

urlpatterns = [
    path("", contact_submit),
    path("staff/messages/acknowledge/", contact_staff_messages_acknowledge),
    path("staff/messages/<int:pk>/", contact_staff_message_delete),
    path("staff/messages/", contact_staff_messages),
]
