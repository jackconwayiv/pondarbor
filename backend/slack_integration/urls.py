from django.urls import path

from slack_integration.interactions import slack_interactions
from slack_integration.views import slack_commands, slack_events

urlpatterns = [
    path("commands/", slack_commands),
    path("events/", slack_events),
    path("interactions/", slack_interactions),
]
