"""Schedule zodiac staff Slack notifications after DB commit."""

from __future__ import annotations

from users.staff_slack_hooks import schedule_staff_slack_notify
from slack_integration.staff_notify import notify_staff_zodiac_chart_waiting


def schedule_zodiac_staff_slack_notify(*, user) -> None:
    schedule_staff_slack_notify(notify_staff_zodiac_chart_waiting, user=user)
