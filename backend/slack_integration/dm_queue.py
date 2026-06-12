"""Cancel queued proactive Slack DMs when underlying events are handled."""

from __future__ import annotations

from slack_integration.models import SlackDmQueueItem

EVENT_FRIENDS_INCOMING = "friends_incoming"
EVENT_CLOSET_BORROW_REQUEST = "closet_borrow_request"
EVENT_CLOSET_CUSTODY_OFFER = "closet_custody_offer"
EVENT_STAFF_PENDING_MEMBER = "staff_pending_member"
EVENT_STAFF_WHATIF = "staff_whatif"
EVENT_STAFF_CONTACT = "staff_contact"
EVENT_STAFF_ZODIAC = "staff_zodiac"


def ref_user(user_id: int) -> str:
    return f"user:{user_id}"


def ref_borrow_request(borrow_request_id: int) -> str:
    return f"borrow_request:{borrow_request_id}"


def ref_item(item_id: int) -> str:
    return f"item:{item_id}"


def ref_question(question_id: int) -> str:
    return f"question:{question_id}"


def ref_contact(message_id: int) -> str:
    return f"contact:{message_id}"


def cancel_slack_dm_queue_items(
    *,
    event_type: str,
    ref_key: str,
    user_id: int | None = None,
) -> int:
    """Delete unsent queue rows. Omit user_id to cancel staff-wide notifications."""
    qs = SlackDmQueueItem.objects.filter(
        sent_at__isnull=True,
        event_type=event_type,
        ref_key=ref_key,
    )
    if user_id is not None:
        qs = qs.filter(user_id=user_id)
    deleted, _ = qs.delete()
    return deleted
