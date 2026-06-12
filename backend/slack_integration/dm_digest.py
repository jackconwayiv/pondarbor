"""Build and send batched proactive Slack DM digests."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from slack_integration.models import SlackDmQueueItem, SlackDmState

logger = logging.getLogger(__name__)

User = get_user_model()

MAX_SLACK_BLOCKS = 48
_TRUNCATION_NOTE = "_Showing the first items — open PondArbor for the full list._"


def pondarbor_origin() -> str:
    return (getattr(settings, "PONDARBOR_ORIGIN", None) or "https://www.pondarbor.com").strip().rstrip("/")


def dm_throttle_enabled() -> bool:
    return bool(getattr(settings, "SLACK_DM_THROTTLE_ENABLED", True))


def dm_throttle_window() -> timedelta:
    hours = int(getattr(settings, "SLACK_DM_THROTTLE_HOURS", 24))
    return timedelta(hours=max(1, hours))


def _section(text: str) -> dict:
    return {"type": "section", "text": {"type": "mrkdwn", "text": text}}


def _divider() -> dict:
    return {"type": "divider"}


def _link_button(*, text: str, url: str) -> dict:
    return {
        "type": "button",
        "text": {"type": "plain_text", "text": text},
        "url": url,
    }


def _item_blocks(item) -> list[dict]:
    blocks = item.blocks if isinstance(item.blocks, list) else []
    if blocks:
        return list(blocks)
    text = (item.text or "").strip()
    if text:
        return [_section(text)]
    return []


def build_digest_blocks(*, items: list, count: int | None = None) -> tuple[str, list[dict]]:
    n = count if count is not None else len(items)
    header = f":mailbox: *PondArbor digest* — {n} update{'s' if n != 1 else ''} since your last message."
    blocks: list[dict] = [_section(header)]
    truncated = False

    for idx, item in enumerate(items):
        chunk = _item_blocks(item)
        if not chunk:
            continue
        if idx > 0:
            if len(blocks) + 1 >= MAX_SLACK_BLOCKS:
                truncated = True
                break
            blocks.append(_divider())
        for block in chunk:
            if len(blocks) >= MAX_SLACK_BLOCKS - 2:
                truncated = True
                break
            blocks.append(block)
        if truncated:
            break

    if truncated:
        blocks.append(_section(_TRUNCATION_NOTE))
    blocks.append(
        {
            "type": "actions",
            "elements": [_link_button(text="Open PondArbor", url=pondarbor_origin())],
        }
    )
    return header, blocks


def _digest_due(state: SlackDmState | None) -> bool:
    if state is None or state.last_proactive_sent_at is None:
        return True
    return state.last_proactive_sent_at + dm_throttle_window() <= timezone.now()


def _send_digest_for_user(*, user: User, items: list[SlackDmQueueItem]) -> bool:
    from slack_integration.notify import _send_slack_dm_now

    if not items:
        return False
    text, blocks = build_digest_blocks(items=items)
    resp = _send_slack_dm_now(user, text=text, blocks=blocks)
    return bool(resp.get("ok"))


def _mark_items_sent(items: list[SlackDmQueueItem], *, sent_at) -> None:
    ids = [item.id for item in items if item.id is not None]
    if ids:
        SlackDmQueueItem.objects.filter(id__in=ids, sent_at__isnull=True).update(sent_at=sent_at)


def send_merged_digest_for_user(
    *,
    user: User,
    pending_items: list[SlackDmQueueItem],
    extra_text: str,
    extra_blocks: list | None,
) -> dict:
    """Send pending proactive items plus one extra notification as a single digest DM."""
    from slack_integration.notify import _send_slack_dm_now

    class _Extra:
        text = extra_text
        blocks = extra_blocks or []

    merged = list(pending_items) + [_Extra()]
    text, blocks = build_digest_blocks(items=merged, count=len(merged))
    resp = _send_slack_dm_now(user, text=text, blocks=blocks)
    if resp.get("ok"):
        _mark_items_sent(pending_items, sent_at=timezone.now())
    return resp


def flush_due_digests() -> int:
    """Site-wide: send digests for every user with a pending batch past the throttle window."""
    if not dm_throttle_enabled():
        return 0

    user_ids = list(
        SlackDmQueueItem.objects.filter(sent_at__isnull=True)
        .values_list("user_id", flat=True)
        .distinct()
    )
    if not user_ids:
        return 0

    sent = 0
    now = timezone.now()
    states = {
        row.user_id: row
        for row in SlackDmState.objects.filter(user_id__in=user_ids)
    }

    for user_id in user_ids:
        state = states.get(user_id)
        if not _digest_due(state):
            continue
        items = list(
            SlackDmQueueItem.objects.filter(user_id=user_id, sent_at__isnull=True).order_by(
                "created_at", "id"
            )
        )
        if not items:
            continue
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            continue
        try:
            with transaction.atomic():
                if _send_digest_for_user(user=user, items=items):
                    _mark_items_sent(items, sent_at=now)
                    state, _ = SlackDmState.objects.get_or_create(user=user)
                    state.last_proactive_sent_at = now
                    state.save(update_fields=["last_proactive_sent_at"])
                    sent += 1
        except Exception:
            logger.exception("flush_due_digests failed user_id=%s", user_id)
    return sent
