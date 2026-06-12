"""Slack DMs for friend-request events."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model

from slack_integration.notify import notify_pondarbor_user_dm
from users.models import Profile

User = get_user_model()


def pondarbor_origin() -> str:
    return (getattr(settings, "PONDARBOR_ORIGIN", None) or "https://www.pondarbor.com").strip().rstrip("/")


def friends_inbox_url() -> str:
    return f"{pondarbor_origin()}/profile?tab=friends"


def _user_label(user: User) -> str:
    profile = Profile.objects.filter(user_id=user.id).first()
    name = (getattr(profile, "display_name", None) or "").strip()
    if name:
        return name
    return (user.email or "").strip() or f"User {user.id}"


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


def notify_incoming_friend_request(*, requested: User, requester: User) -> dict:
    label = _user_label(requester)
    email = (requester.email or "").strip()
    detail_lines = [f":wave: *Friends* — *{label}* sent you a friend request."]
    if email and email.lower() != label.lower():
        detail_lines.append(f"_{email}_")
    text = "\n".join(detail_lines)
    blocks = [
        {"type": "section", "text": {"type": "mrkdwn", "text": text}},
        {
            "type": "actions",
            "elements": [
                _action_button(
                    action_id="friends_accept",
                    text="Accept",
                    value=str(requester.id),
                    style="primary",
                ),
                _action_button(
                    action_id="friends_decline",
                    text="Decline",
                    value=str(requester.id),
                ),
                _link_button(text="Open in PondArbor", url=friends_inbox_url()),
            ],
        },
    ]
    return notify_pondarbor_user_dm(requested, text=text, blocks=blocks, feature="friends")
