"""Slack slash commands for Closet (/closet, /loans)."""

from __future__ import annotations

from django.http import JsonResponse

from closet.slack_notify import build_closet_inbox_blocks, build_loans_summary_blocks
from slack_integration.notify import notify_pondarbor_user_dm
from users.models import User


def _slack_ephemeral(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "ephemeral", "text": text})


def _require_approved_user(user: User | None, err: str | None) -> JsonResponse | None:
    if err or not user:
        return _slack_ephemeral(err or "Could not resolve your account.")
    if user.account_status != User.AccountStatus.APPROVED:
        return _slack_ephemeral("Your PondArbor account is still pending approval.")
    return None


def handle_slack_closet_command(*, user: User | None, err: str | None) -> JsonResponse:
    gate = _require_approved_user(user, err)
    if gate:
        return gate
    blocks, _ = build_closet_inbox_blocks(user)
    notify_pondarbor_user_dm(user, text="Your Closet inbox.", blocks=blocks, rate="immediate")
    return _slack_ephemeral("Sent your closet inbox.")


def handle_slack_loans_command(*, user: User | None, err: str | None) -> JsonResponse:
    gate = _require_approved_user(user, err)
    if gate:
        return gate
    blocks, _ = build_loans_summary_blocks(user)
    notify_pondarbor_user_dm(user, text="Your loans and holdings summary.", blocks=blocks, rate="immediate")
    return _slack_ephemeral("Sent your loans summary.")
