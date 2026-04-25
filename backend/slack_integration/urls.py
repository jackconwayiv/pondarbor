from django.urls import path

from slack_integration.views import slack_commands

urlpatterns = [
    path("commands/", slack_commands),
]
