"""`/pondarbor` slash command — opt in or out of proactive ArborBot DMs."""

from __future__ import annotations

from django.http import JsonResponse

from slack_integration.dm_throttle import flush_user_backlog_if_due
from slack_integration.models import SlackIdentity
from users.models import User


def _slack_ephemeral(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "ephemeral", "text": text})


def handle_slack_pondarbor_command(
    *,
    user: User | None,
    err: str | None,
    team_id: str,
    slack_user_id: str,
    text: str,
) -> JsonResponse:
    if err:
        return _slack_ephemeral(err)
    if user is None:
        return _slack_ephemeral("Could not resolve your account.")
    if user.account_status != User.AccountStatus.APPROVED:
        return _slack_ephemeral("Your PondArbor account is still pending approval.")

    ident = SlackIdentity.objects.filter(
        team_id=team_id,
        slack_user_id=slack_user_id,
        user=user,
    ).first()
    if ident is None:
        return _slack_ephemeral("Could not find your Slack link. Try another slash command first.")

    sub = (text or "").strip().lower()
    if sub == "on":
        if not ident.arborbot_dms_enabled:
            ident.arborbot_dms_enabled = True
            ident.save(update_fields=["arborbot_dms_enabled", "updated_at"])
        flush_user_backlog_if_due(user)
        return _slack_ephemeral("ArborBot DMs are now on.")
    if sub == "off":
        if ident.arborbot_dms_enabled:
            ident.arborbot_dms_enabled = False
            ident.save(update_fields=["arborbot_dms_enabled", "updated_at"])
        return _slack_ephemeral("ArborBot DMs are now off.")

    if ident.arborbot_dms_enabled:
        return _slack_ephemeral(
            'ArborBot DMs are currently set to ON. Type "/pondarbor off" to toggle.'
        )
    return _slack_ephemeral(
        'ArborBot DMs are currently set to OFF. Type "/pondarbor on" to toggle.'
    )
