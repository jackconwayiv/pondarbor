"""Send true Slack DMs to PondArbor users linked via SlackIdentity."""

from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model

from slack_integration.models import SlackIdentity
from slack_integration.slack_api import slack_chat_post_dm

logger = logging.getLogger(__name__)

User = get_user_model()


def closet_notifications_enabled() -> bool:
    return bool(getattr(settings, "SLACK_CLOSET_NOTIFICATIONS_ENABLED", True))


def notify_pondarbor_user_dm(user, *, text: str, blocks: list | None = None) -> dict:
    if not closet_notifications_enabled():
        return {"ok": False, "skipped": "disabled"}
    if not (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip():
        return {"ok": False, "skipped": "missing_bot_token"}

    ident = (
        SlackIdentity.objects.filter(user_id=user.id)
        .order_by("-updated_at")
        .first()
    )
    if not ident:
        logger.info("closet_slack_dm skipped: no SlackIdentity for user_id=%s", user.id)
        return {"ok": False, "skipped": "no_slack_identity"}

    resp = slack_chat_post_dm(
        slack_user_id=ident.slack_user_id,
        text=text,
        blocks=blocks,
    )
    if not resp.get("ok"):
        logger.warning(
            "closet_slack_dm failed user_id=%s slack_user=%s error=%s",
            user.id,
            ident.slack_user_id,
            resp.get("error"),
        )
    return resp
