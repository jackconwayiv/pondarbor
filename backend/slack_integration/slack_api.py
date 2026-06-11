import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_SLACK_API = "https://slack.com/api"


def _slack_bot_token() -> str:
    return (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip()


def slack_chat_post_message(
    *,
    channel: str,
    text: str,
    blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    token = _slack_bot_token()
    if not token:
        return {"ok": False, "error": "missing_bot_token"}
    body: dict[str, Any] = {"channel": channel, "text": text}
    if blocks:
        body["blocks"] = blocks
    r = requests.post(
        f"{_SLACK_API}/chat.postMessage",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
        json=body,
        timeout=12,
    )
    try:
        return r.json()
    except ValueError:
        logger.warning("slack chat.postMessage non-json status=%s", r.status_code)
        return {"ok": False, "error": "invalid_json"}


def slack_conversations_open(*, slack_user_id: str) -> dict[str, Any]:
    token = _slack_bot_token()
    if not token:
        return {"ok": False, "error": "missing_bot_token"}
    r = requests.post(
        f"{_SLACK_API}/conversations.open",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
        json={"users": slack_user_id},
        timeout=12,
    )
    try:
        return r.json()
    except ValueError:
        logger.warning("slack conversations.open non-json status=%s", r.status_code)
        return {"ok": False, "error": "invalid_json"}


def slack_chat_post_dm(
    *,
    slack_user_id: str,
    text: str,
    blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    opened = slack_conversations_open(slack_user_id=slack_user_id)
    if not opened.get("ok"):
        return opened
    channel = ((opened.get("channel") or {}).get("id") or "").strip()
    if not channel:
        return {"ok": False, "error": "missing_dm_channel"}
    return slack_chat_post_message(channel=channel, text=text, blocks=blocks)


def slack_users_info(*, slack_user_id: str) -> dict[str, Any]:
    token = _slack_bot_token()
    if not token:
        return {"ok": False, "error": "missing_bot_token"}
    r = requests.get(
        f"{_SLACK_API}/users.info",
        headers={"Authorization": f"Bearer {token}"},
        params={"user": slack_user_id},
        timeout=12,
    )
    try:
        return r.json()
    except ValueError:
        logger.warning("slack users.info non-json status=%s", r.status_code)
        return {"ok": False, "error": "invalid_json"}


def slack_chat_post_ephemeral(
    *,
    channel: str,
    user: str,
    text: str,
    blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    token = _slack_bot_token()
    if not token:
        return {"ok": False, "error": "missing_bot_token"}
    body: dict[str, Any] = {"channel": channel, "user": user, "text": text}
    if blocks:
        body["blocks"] = blocks
    r = requests.post(
        f"{_SLACK_API}/chat.postEphemeral",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
        json=body,
        timeout=12,
    )
    try:
        return r.json()
    except ValueError:
        logger.warning("slack chat.postEphemeral non-json status=%s", r.status_code)
        return {"ok": False, "error": "invalid_json"}
