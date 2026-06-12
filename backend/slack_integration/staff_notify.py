"""Slack DMs to PondArbor staff (is_staff users with SlackIdentity)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model

from slack_integration.dm_queue import (
    EVENT_STAFF_CONTACT,
    EVENT_STAFF_PENDING_MEMBER,
    EVENT_STAFF_WHATIF,
    EVENT_STAFF_ZODIAC,
    ref_contact,
    ref_question,
    ref_user,
)
from slack_integration.models import SlackIdentity
from slack_integration.notify import notify_pondarbor_user_dm

logger = logging.getLogger(__name__)

User = get_user_model()


def staff_notifications_enabled() -> bool:
    return bool(getattr(settings, "SLACK_STAFF_NOTIFICATIONS_ENABLED", True))


def pondarbor_origin() -> str:
    return (getattr(settings, "PONDARBOR_ORIGIN", None) or "https://www.pondarbor.com").strip().rstrip("/")


def staff_page_url() -> str:
    return f"{pondarbor_origin()}/staff"


def staff_zodiac_url() -> str:
    return f"{pondarbor_origin()}/staff/zodiac"


def whatif_admin_url() -> str:
    return f"{pondarbor_origin()}/whatif/admin"


def staff_contact_url() -> str:
    return f"{pondarbor_origin()}/staff?tab=contact"


def _truncate_slack_text(text: str, *, max_len: int = 200) -> str:
    raw = " ".join((text or "").split())
    if len(raw) <= max_len:
        return raw
    return raw[: max_len - 1].rstrip() + "…"


def _link_button(*, text: str, url: str) -> dict:
    return {
        "type": "button",
        "text": {"type": "plain_text", "text": text},
        "url": url,
    }


def _action_button(*, action_id: str, text: str, value: str, style: str | None = None) -> dict:
    btn: dict = {
        "type": "button",
        "action_id": action_id,
        "text": {"type": "plain_text", "text": text},
        "value": value,
    }
    if style:
        btn["style"] = style
    return btn


def _staff_dm_blocks(*, line: str, elements: list[dict]) -> list[dict]:
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": line}},
        {"type": "actions", "elements": elements[:5]},
    ]


def staff_users_with_slack() -> list[User]:
    if not staff_notifications_enabled():
        return []
    staff_ids = set(
        User.objects.filter(
            is_staff=True,
            account_status=User.AccountStatus.APPROVED,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
    )
    if not staff_ids:
        return []
    linked_ids = set(
        SlackIdentity.objects.filter(user_id__in=staff_ids).values_list("user_id", flat=True).distinct()
    )
    if not linked_ids:
        return []
    return list(User.objects.filter(id__in=linked_ids))


def notify_all_staff(
    *,
    text: str,
    blocks: list[dict] | None = None,
    event_type: str = "",
    ref_key: str = "",
) -> int:
    """Best-effort DM to each linked staff user. Returns count sent (ok=True)."""
    if not staff_notifications_enabled():
        return 0
    if not (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip():
        return 0
    sent = 0
    for staff_user in staff_users_with_slack():
        resp = notify_pondarbor_user_dm(
            staff_user,
            text=text,
            blocks=blocks,
            feature="staff",
            event_type=event_type,
            ref_key=ref_key,
        )
        if resp.get("ok"):
            sent += 1
    if sent == 0 and staff_users_with_slack():
        logger.info("staff_slack_dm: no deliveries succeeded")
    return sent


def notify_staff_new_pending_member(*, user: User) -> int:
    label = (user.email or "").strip() or f"User {user.id}"
    text = f":bust_in_silhouette: *New member* — {label} is awaiting approval."
    blocks = _staff_dm_blocks(
        line=text,
        elements=[
            _action_button(
                action_id="staff_approve_member",
                text="Approve",
                value=str(user.id),
                style="primary",
            ),
            _action_button(
                action_id="staff_reject_member",
                text="Reject",
                value=str(user.id),
            ),
            _link_button(text="Open Staff", url=staff_page_url()),
        ],
    )
    return notify_all_staff(
        text=text,
        blocks=blocks,
        event_type=EVENT_STAFF_PENDING_MEMBER,
        ref_key=ref_user(user.id),
    )


def _zodiac_detail_lines(*, user: User) -> list[str]:
    from zodiac.models import AstroProfile

    profile = AstroProfile.objects.filter(user_id=user.id).first()
    if profile is None:
        return []
    lines: list[str] = []
    if profile.birth_date:
        lines.append(f"Birth date: `{profile.birth_date.isoformat()}`")
    if profile.birth_time:
        lines.append(f"Birth time: `{profile.birth_time.strftime('%H:%M')}`")
    elif profile.birth_time_unknown:
        lines.append("Birth time: _unknown_")
    locality_parts = [p for p in (profile.locality, profile.admin_area, profile.country_code) if p]
    if locality_parts:
        lines.append(f"Location: {', '.join(locality_parts)}")
    return lines


def notify_staff_zodiac_chart_waiting(*, user: User) -> int:
    label = (user.email or "").strip() or f"User {user.id}"
    lines = [f":sparkles: *Birth chart* — {label} submitted birth details for staff import."]
    lines.extend(_zodiac_detail_lines(user=user))
    text = "\n".join(lines)
    blocks = _staff_dm_blocks(
        line=text,
        elements=[_link_button(text="Import chart in PondArbor", url=staff_zodiac_url())],
    )
    return notify_all_staff(
        text=text,
        blocks=blocks,
        event_type=EVENT_STAFF_ZODIAC,
        ref_key=ref_user(user.id),
    )


def _whatif_detail_lines(*, question) -> list[str]:
    from whatif.models import WhatIfQuestion

    q = (
        WhatIfQuestion.objects.select_related("proposed_by")
        .filter(pk=question.pk)
        .first()
        or question
    )
    proposer = getattr(q, "proposed_by", None)
    label = (getattr(proposer, "email", None) or "").strip() or "A member"
    lines = [f":question: *WhatIf* — {label} proposed a question for review."]
    snippet = _truncate_slack_text(q.prompt, max_len=280)
    if snippet:
        lines.append(f"*Prompt:* _{snippet}_")
    answers = [
        _truncate_slack_text(q.answer_1, max_len=40),
        _truncate_slack_text(q.answer_2, max_len=40),
        _truncate_slack_text(q.answer_3, max_len=40),
        _truncate_slack_text(q.answer_4, max_len=40),
        _truncate_slack_text(q.answer_5, max_len=40),
        _truncate_slack_text(q.answer_6, max_len=40),
    ]
    lines.append("*Answers:* " + " · ".join(f"{i + 1}. {a}" for i, a in enumerate(answers)))
    return lines


def notify_staff_whatif_question_proposed(*, question) -> int:
    text = "\n".join(_whatif_detail_lines(question=question))
    blocks = _staff_dm_blocks(
        line=text,
        elements=[
            _action_button(
                action_id="staff_whatif_approve",
                text="Approve",
                value=str(question.id),
                style="primary",
            ),
            _action_button(
                action_id="staff_whatif_reject",
                text="Reject",
                value=str(question.id),
            ),
            _link_button(text="Open WhatIf Admin", url=whatif_admin_url()),
        ],
    )
    return notify_all_staff(
        text=text,
        blocks=blocks,
        event_type=EVENT_STAFF_WHATIF,
        ref_key=ref_question(question.id),
    )


def notify_staff_contact_message(*, contact_message) -> int:
    from contact.models import ContactMessage

    cm = (
        ContactMessage.objects.select_related("from_user")
        .filter(pk=contact_message.pk)
        .first()
        or contact_message
    )
    label = (cm.from_user.email or "").strip() or f"User {cm.from_user_id}"
    snippet = _truncate_slack_text(cm.message, max_len=500)
    lines = [f":envelope: *Contact* — new message from {label}."]
    if snippet:
        lines.append(f"_{snippet}_")
    text = "\n".join(lines)
    blocks = _staff_dm_blocks(
        line=text,
        elements=[
            _action_button(
                action_id="staff_contact_ack",
                text="Mark read",
                value=str(cm.id),
                style="primary",
            ),
            _link_button(text="Open Contact Inbox", url=staff_contact_url()),
        ],
    )
    return notify_all_staff(
        text=text,
        blocks=blocks,
        event_type=EVENT_STAFF_CONTACT,
        ref_key=ref_contact(cm.id),
    )
