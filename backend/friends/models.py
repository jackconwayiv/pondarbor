from django.conf import settings
from django.db import models
from django.db.models import Q, F


class FriendRequest(models.Model):
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_friend_requests",
    )
    requested = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_friend_requests",
    )
    is_accepted = models.BooleanField(default=False)
    ignored_by_requester = models.BooleanField(default=False)
    ignored_by_requested = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["requester", "requested"],
                name="uniq_friend_request_pair",
            ),
            models.CheckConstraint(
                condition=~Q(requester=F("requested")),
                name="friend_request_no_self",
            ),
        ]

