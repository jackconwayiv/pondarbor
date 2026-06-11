"""Schedule Closet Slack notifications after DB commit."""

from __future__ import annotations

import logging
from collections.abc import Callable

from django.db import transaction

from slack_integration.notify import closet_notifications_enabled

logger = logging.getLogger(__name__)


def schedule_closet_slack_notify(callback: Callable[..., None], /, *args, **kwargs) -> None:
    if not closet_notifications_enabled():
        return

    def _run() -> None:
        try:
            callback(*args, **kwargs)
        except Exception:
            logger.exception("closet_slack_notify failed")

    transaction.on_commit(_run)
