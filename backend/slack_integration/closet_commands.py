"""Slack slash commands for Closet (/closet, /loans, /request)."""

from __future__ import annotations

from django.http import JsonResponse

from closet.slack_ask_parse import parse_request_command_text
from closet.slack_notify import build_closet_inbox_blocks, build_loans_summary_blocks
from slack_integration.closet_ask import (
    create_slash_closet_request,
    post_crowd_ask_to_closet,
)
from slack_integration.notify import closet_channel_id, notify_closet_channel_ephemeral
from slack_integration.slack_ids import normalize_slack_channel_id
from users.models import User


def _slack_ephemeral(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "ephemeral", "text": text})


def _ephemeral_blocks(text: str, blocks: list) -> JsonResponse:
    body: dict = {"response_type": "ephemeral", "text": text}
    if blocks:
        body["blocks"] = blocks
    return JsonResponse(body)


def _closet_private_blocks(
    *,
    user: User,
    text: str,
    blocks: list,
    channel_id: str,
    elsewhere_ack: str,
) -> JsonResponse:
    closet = closet_channel_id()
    if not closet:
        return _slack_ephemeral(
            "Closet channel isn't configured. Set `SLACK_CLOSET_CHANNEL_ID` and invite @ArborBot."
        )
    invoke = normalize_slack_channel_id(channel_id)
    if invoke == closet:
        return _ephemeral_blocks(text, blocks)
    resp = notify_closet_channel_ephemeral(user, text=text, blocks=blocks)
    skipped = str(resp.get("skipped") or "")
    if skipped == "disabled":
        return _slack_ephemeral("Closet Slack notifications are disabled.")
    if skipped == "no_slack_identity":
        return _slack_ephemeral("Link your PondArbor account to use Closet in Slack.")
    if not resp.get("ok") and not skipped:
        err_code = str(resp.get("error") or "unknown")
        return _slack_ephemeral(
            f"Couldn't post in the closet channel (`{err_code}`). "
            "Invite @ArborBot and check `SLACK_CLOSET_CHANNEL_ID`."
        )
    return _slack_ephemeral(elsewhere_ack)


def _require_approved_user(user: User | None, err: str | None) -> JsonResponse | None:
    if err or not user:
        return _slack_ephemeral(err or "Could not resolve your account.")
    if user.account_status != User.AccountStatus.APPROVED:
        return _slack_ephemeral("Your PondArbor account is still pending approval.")
    return None


def handle_slack_closet_command(
    *,
    user: User | None,
    err: str | None,
    channel_id: str = "",
) -> JsonResponse:
    gate = _require_approved_user(user, err)
    if gate:
        return gate
    blocks, _ = build_closet_inbox_blocks(user)
    return _closet_private_blocks(
        user=user,
        text="Your Closet inbox.",
        blocks=blocks,
        channel_id=channel_id,
        elsewhere_ack="Posted your closet inbox in the closet channel.",
    )


def handle_slack_loans_command(
    *,
    user: User | None,
    err: str | None,
    channel_id: str = "",
) -> JsonResponse:
    gate = _require_approved_user(user, err)
    if gate:
        return gate
    blocks, _ = build_loans_summary_blocks(user)
    return _closet_private_blocks(
        user=user,
        text="Your loans and holdings summary.",
        blocks=blocks,
        channel_id=channel_id,
        elsewhere_ack="Posted your loans summary in the closet channel.",
    )


def handle_slack_request_command(
    *,
    user: User | None,
    err: str | None,
    team_id: str,
    text: str,
    channel_id: str,
) -> JsonResponse:
    gate = _require_approved_user(user, err)
    if gate:
        return gate
    closet = closet_channel_id()
    if not closet:
        return _slack_ephemeral(
            "Closet channel isn't configured. Set `SLACK_CLOSET_CHANNEL_ID` and invite @ArborBot."
        )
    item_query, _qty = parse_request_command_text(text)
    if not item_query:
        return _slack_ephemeral("Add an item after `/request`, e.g. `/request a weedwhacker`.")

    ask, _matches, crowd_blocks, crowd_text = create_slash_closet_request(
        user=user,
        team_id=team_id,
        command_text=text,
        closet_channel=closet,
    )
    invoke = normalize_slack_channel_id(channel_id)
    if invoke == closet:
        return JsonResponse(
            {
                "response_type": "in_channel",
                "text": crowd_text,
                "blocks": crowd_blocks,
            }
        )

    posted = post_crowd_ask_to_closet(ask=ask, blocks=crowd_blocks, text=crowd_text)
    if not posted.get("ok"):
        err_code = str(posted.get("error") or "unknown")
        return _slack_ephemeral(
            f"Couldn't post your request for *{ask.item_query}* in the closet channel "
            f"(`{err_code}`). Invite @ArborBot to the channel and check `SLACK_CLOSET_CHANNEL_ID`."
        )
    return _slack_ephemeral(f"Posted your request for *{ask.item_query}* in the closet channel.")
