"""Proactive Slack DM throttle: send, queue, merge, and site-wide flush."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from slack_integration.dm_digest import (
    dm_throttle_enabled,
    dm_throttle_window,
    flush_due_digests,
    send_merged_digest_for_user,
)
from slack_integration.models import SlackDmQueueItem, SlackDmState

logger = logging.getLogger(__name__)

User = get_user_model()


def _cooldown_expired(last_sent_at) -> bool:
    if last_sent_at is None:
        return True
    return last_sent_at + dm_throttle_window() <= timezone.now()


def _user_bypasses_dm_throttle(user) -> bool:
    return bool(getattr(user, "is_staff", False))


def enqueue_or_send_proactive_dm(
    user,
    *,
    text: str,
    blocks: list | None,
    feature: str,
) -> dict:
    from slack_integration.notify import _send_slack_dm_now

    if not dm_throttle_enabled():
        return _send_slack_dm_now(user, text=text, blocks=blocks)

    if _user_bypasses_dm_throttle(user):
        resp = _send_slack_dm_now(user, text=text, blocks=blocks)
        try:
            flush_due_digests()
        except Exception:
            logger.exception("flush_due_digests after staff proactive dm user_id=%s", user.id)
        return resp

    state, _ = SlackDmState.objects.get_or_create(user=user)
    pending = list(
        SlackDmQueueItem.objects.filter(user=user, sent_at__isnull=True).order_by("created_at", "id")
    )

    if _cooldown_expired(state.last_proactive_sent_at):
        if pending:
            resp = send_merged_digest_for_user(
                user=user,
                pending_items=pending,
                extra_text=text,
                extra_blocks=blocks,
            )
        else:
            resp = _send_slack_dm_now(user, text=text, blocks=blocks)
        if resp.get("ok"):
            state.last_proactive_sent_at = timezone.now()
            state.save(update_fields=["last_proactive_sent_at"])
    else:
        SlackDmQueueItem.objects.create(
            user=user,
            feature=feature,
            text=text,
            blocks=blocks or [],
        )
        resp = {"ok": True, "queued": True}

    try:
        flush_due_digests()
    except Exception:
        logger.exception("flush_due_digests after proactive dm user_id=%s", user.id)

    return resp
