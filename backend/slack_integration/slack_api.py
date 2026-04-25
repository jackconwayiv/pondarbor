import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_SLACK_API = "https://slack.com/api"


def slack_chat_post_message(*, channel: str, text: str) -> dict[str, Any]:
    token = (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip()
    if not token:
        return {"ok": False, "error": "missing_bot_token"}
    r = requests.post(
        f"{_SLACK_API}/chat.postMessage",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
        json={"channel": channel, "text": text},
        timeout=12,
    )
    try:
        return r.json()
    except ValueError:
        logger.warning("slack chat.postMessage non-json status=%s", r.status_code)
        return {"ok": False, "error": "invalid_json"}


def slack_users_info(*, slack_user_id: str) -> dict[str, Any]:
    token = (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip()
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
