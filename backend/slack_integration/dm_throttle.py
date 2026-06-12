"""Proactive Slack DM throttle: send, queue, merge, and site-wide flush."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from slack_integration.dm_digest import (
    _mark_items_sent,
    _send_digest_for_user,
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


def enqueue_proactive_dm_only(
    user,
    *,
    text: str,
    blocks: list | None,
    feature: str,
    event_type: str = "",
    ref_key: str = "",
) -> dict:
    """Queue a proactive DM without sending (opted-out users)."""
    SlackDmQueueItem.objects.create(
        user=user,
        feature=feature,
        event_type=event_type,
        ref_key=ref_key,
        text=text,
        blocks=blocks or [],
    )
    return {"ok": True, "queued": True, "skipped": "dms_opt_out"}


def enqueue_or_send_proactive_dm(
    user,
    *,
    text: str,
    blocks: list | None,
    feature: str,
    event_type: str = "",
    ref_key: str = "",
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
            event_type=event_type,
            ref_key=ref_key,
            text=text,
            blocks=blocks or [],
        )
        resp = {"ok": True, "queued": True}

    try:
        flush_due_digests()
    except Exception:
        logger.exception("flush_due_digests after proactive dm user_id=%s", user.id)

    return resp


def flush_user_backlog_if_due(user) -> dict:
    """After opt-in, attempt to deliver queued proactive DMs for one user."""
    from slack_integration.notify import user_accepts_arborbot_dms

    if not user_accepts_arborbot_dms(user):
        return {"ok": False, "skipped": "dms_opt_out"}

    pending = list(
        SlackDmQueueItem.objects.filter(user=user, sent_at__isnull=True).order_by("created_at", "id")
    )
    if not pending:
        return {"ok": True, "skipped": "empty"}

    if not dm_throttle_enabled():
        if _send_digest_for_user(user=user, items=pending):
            _mark_items_sent(pending, sent_at=timezone.now())
            return {"ok": True}
        return {"ok": False}

    state, _ = SlackDmState.objects.get_or_create(user=user)
    if _user_bypasses_dm_throttle(user) or _cooldown_expired(state.last_proactive_sent_at):
        if _send_digest_for_user(user=user, items=pending):
            now = timezone.now()
            _mark_items_sent(pending, sent_at=now)
            state.last_proactive_sent_at = now
            state.save(update_fields=["last_proactive_sent_at"])
            return {"ok": True}
        return {"ok": False}

    return {"ok": True, "queued": True}
