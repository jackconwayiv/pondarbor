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


def _feature_notifications_enabled(feature: str) -> bool:
    if feature == "staff":
        from slack_integration.staff_notify import staff_notifications_enabled

        return staff_notifications_enabled()
    if feature == "friends":
        return bool(getattr(settings, "SLACK_FRIEND_NOTIFICATIONS_ENABLED", True))
    return closet_notifications_enabled()


def user_accepts_arborbot_dms(
    user,
    *,
    team_id: str | None = None,
    slack_user_id: str | None = None,
) -> bool:
    """True when the SlackIdentity that would receive proactive DMs has opted in."""
    qs = SlackIdentity.objects.filter(user_id=user.id)
    if team_id and slack_user_id:
        ident = qs.filter(team_id=team_id, slack_user_id=slack_user_id).first()
    else:
        ident = qs.order_by("-updated_at").first()
    return bool(ident and ident.arborbot_dms_enabled)


def _send_slack_dm_now(user, *, text: str, blocks: list | None = None) -> dict:
    if not (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip():
        return {"ok": False, "skipped": "missing_bot_token"}

    ident = (
        SlackIdentity.objects.filter(user_id=user.id)
        .order_by("-updated_at")
        .first()
    )
    if not ident:
        logger.info("slack_dm skipped: no SlackIdentity for user_id=%s", user.id)
        return {"ok": False, "skipped": "no_slack_identity"}

    resp = slack_chat_post_dm(
        slack_user_id=ident.slack_user_id,
        text=text,
        blocks=blocks,
    )
    if not resp.get("ok"):
        logger.warning(
            "slack_dm failed user_id=%s slack_user=%s error=%s",
            user.id,
            ident.slack_user_id,
            resp.get("error"),
        )
    return resp


def notify_pondarbor_user_dm(
    user,
    *,
    text: str,
    blocks: list | None = None,
    feature: str = "closet",
    rate: str = "proactive",
    event_type: str = "",
    ref_key: str = "",
) -> dict:
    if not _feature_notifications_enabled(feature):
        return {"ok": False, "skipped": "disabled"}

    if rate == "immediate":
        return _send_slack_dm_now(user, text=text, blocks=blocks)

    if not user_accepts_arborbot_dms(user):
        from slack_integration.dm_throttle import enqueue_proactive_dm_only

        return enqueue_proactive_dm_only(
            user,
            text=text,
            blocks=blocks,
            feature=feature,
            event_type=event_type,
            ref_key=ref_key,
        )

    from slack_integration.dm_throttle import enqueue_or_send_proactive_dm

    return enqueue_or_send_proactive_dm(
        user,
        text=text,
        blocks=blocks,
        feature=feature,
        event_type=event_type,
        ref_key=ref_key,
    )
