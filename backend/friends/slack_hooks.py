"""Schedule friend Slack notifications after DB commit."""

from __future__ import annotations

import logging
from collections.abc import Callable

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def friend_notifications_enabled() -> bool:
    return bool(getattr(settings, "SLACK_FRIEND_NOTIFICATIONS_ENABLED", True))


def schedule_friend_slack_notify(callback: Callable[..., None], /, *args, **kwargs) -> None:
    if not friend_notifications_enabled():
        return

    def _run() -> None:
        try:
            callback(*args, **kwargs)
        except Exception:
            logger.exception("friend_slack_notify failed")

    transaction.on_commit(_run)
