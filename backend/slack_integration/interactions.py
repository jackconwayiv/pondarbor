"""Slack Block Kit interaction handler for PondArbor actions."""

from __future__ import annotations

import json
import logging
from urllib.parse import parse_qsl

from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from closet.actions import (
    ClosetActionError,
    accept_custody,
    approve_borrow_request,
    confirm_custody_return,
    confirm_loan_return,
    decline_borrow_request,
    mark_custody_returned_by_holder,
    mark_loan_returned_by_borrower,
    reject_pending_custody,
)
from closet.slack_hooks import schedule_closet_slack_notify
from closet.slack_notify import (
    notify_borrow_request_approved_to_requester,
    notify_borrow_request_declined_to_requester,
    notify_custody_marked_returned_to_owner,
    notify_custody_offer_rejected_to_owner,
    notify_custody_return_completed_to_holder,
    notify_loan_marked_returned_to_owner,
    notify_loan_return_completed_to_borrower,
    notify_slack_action_confirmation,
)
from contact.actions import ContactActionError, acknowledge_contact_message
from friends.actions import (
    FriendActionError,
    accept_incoming_friend_request,
    decline_incoming_friend_request,
)
from slack_integration.closet_ask import (
    handle_create_item,
    handle_i_do,
    handle_i_dont,
    handle_offer_no,
    handle_offer_yes,
    handle_pick_item,
    handle_request_loan,
)
from slack_integration.slack_api import slack_chat_post_ephemeral
from slack_integration.slack_verify import verify_slack_request_signature
from slack_integration.views import _resolve_user_for_slack
from users.models import User
from users.staff_actions import StaffActionError, approve_pending_member, reject_pending_member
from whatif.actions import WhatIfActionError, approve_proposed_whatif, reject_proposed_whatif

logger = logging.getLogger(__name__)


def _resolve_user_from_payload(payload: dict) -> User | None:
    team_id = (payload.get("team") or {}).get("id") or (payload.get("team_id") or "")
    team_id = str(team_id).strip()
    slack_user_id = (payload.get("user") or {}).get("id") or ""
    slack_user_id = str(slack_user_id).strip()
    if not team_id or not slack_user_id:
        return None
    user, err = _resolve_user_for_slack(team_id, slack_user_id)
    if err or not user:
        return None
    if user.account_status != User.AccountStatus.APPROVED:
        return None
    return user


def _action_value(action: dict) -> str:
    value = (action.get("value") or "").strip()
    if value:
        return value
    selected = action.get("selected_option") or {}
    return str(selected.get("value") or "").strip()


def _parse_id_pair(value: str) -> tuple[int, int]:
    left, right = value.split(":", 1)
    return int(left), int(right)


def _run_action(*, user: User, action_id: str, value: str, payload: dict) -> None:
    if action_id == "closet_request_loan":
        ask_id, item_id = _parse_id_pair(value)
        handle_request_loan(user=user, ask_id=ask_id, item_id=item_id)
        return
    if action_id == "closet_ask_i_do":
        handle_i_do(user=user, ask_id=int(value))
        return
    if action_id == "closet_ask_i_dont":
        channel_id = str((payload.get("channel") or {}).get("id") or "").strip()
        slack_user_id = str((payload.get("user") or {}).get("id") or "").strip()
        handle_i_dont(user=user, ask_id=int(value), channel_id=channel_id, slack_user_id=slack_user_id)
        return
    if action_id == "closet_ask_pick_item":
        ask_id, item_id = _parse_id_pair(value)
        handle_pick_item(user=user, ask_id=ask_id, item_id=item_id)
        return
    if action_id == "closet_ask_create_item":
        handle_create_item(user=user, ask_id=int(value))
        return
    if action_id == "closet_offer_loan_yes":
        handle_offer_yes(user=user, offer_id=int(value))
        return
    if action_id == "closet_offer_loan_no":
        handle_offer_no(user=user, offer_id=int(value))
        return
    if action_id == "closet_approve":
        loan = approve_borrow_request(user=user, borrow_request_id=int(value))
        schedule_closet_slack_notify(notify_borrow_request_approved_to_requester, loan=loan)
        notify_slack_action_confirmation(user=user, text="Approved ✓")
        return
    if action_id == "closet_decline":
        row = decline_borrow_request(user=user, borrow_request_id=int(value))
        schedule_closet_slack_notify(notify_borrow_request_declined_to_requester, row=row)
        notify_slack_action_confirmation(user=user, text="Declined.")
        return
    if action_id == "closet_accept_custody":
        accept_custody(user=user, item_id=int(value))
        notify_slack_action_confirmation(user=user, text="Custody accepted ✓")
        return
    if action_id == "closet_reject_custody":
        item = reject_pending_custody(user=user, item_id=int(value))
        schedule_closet_slack_notify(
            notify_custody_offer_rejected_to_owner,
            item=item,
            holder=user,
        )
        notify_slack_action_confirmation(user=user, text="Custody offer declined.")
        return
    if action_id == "closet_mark_loan_returned":
        loan, first_mark = mark_loan_returned_by_borrower(user=user, loan_id=int(value))
        if first_mark:
            schedule_closet_slack_notify(notify_loan_marked_returned_to_owner, loan=loan)
        notify_slack_action_confirmation(user=user, text="Marked as returned. The owner will confirm.")
        return
    if action_id == "closet_mark_custody_returned":
        item, first_mark = mark_custody_returned_by_holder(user=user, item_id=int(value))
        if first_mark:
            schedule_closet_slack_notify(notify_custody_marked_returned_to_owner, item=item)
        notify_slack_action_confirmation(user=user, text="Marked as returned. The owner will confirm.")
        return
    if action_id == "closet_confirm_loan":
        loan = confirm_loan_return(user=user, loan_id=int(value))
        schedule_closet_slack_notify(notify_loan_return_completed_to_borrower, loan=loan)
        notify_slack_action_confirmation(user=user, text="Return confirmed ✓")
        return
    if action_id == "closet_confirm_custody":
        item, former_holder = confirm_custody_return(user=user, item_id=int(value))
        if former_holder is not None:
            schedule_closet_slack_notify(
                notify_custody_return_completed_to_holder,
                item=item,
                holder=former_holder,
            )
        notify_slack_action_confirmation(user=user, text="Return confirmed ✓")
        return
    if action_id == "friends_accept":
        accept_incoming_friend_request(user=user, requester_id=int(value))
        notify_slack_action_confirmation(user=user, text="Friend request accepted ✓")
        return
    if action_id == "friends_decline":
        decline_incoming_friend_request(user=user, requester_id=int(value))
        notify_slack_action_confirmation(user=user, text="Friend request declined.")
        return
    if action_id == "staff_approve_member":
        approve_pending_member(staff_user=user, user_id=int(value))
        notify_slack_action_confirmation(user=user, text="Member approved ✓")
        return
    if action_id == "staff_reject_member":
        reject_pending_member(staff_user=user, user_id=int(value))
        notify_slack_action_confirmation(user=user, text="Member rejected.")
        return
    if action_id == "staff_whatif_approve":
        approve_proposed_whatif(staff_user=user, question_id=int(value))
        notify_slack_action_confirmation(user=user, text="WhatIf question approved ✓")
        return
    if action_id == "staff_whatif_reject":
        reject_proposed_whatif(staff_user=user, question_id=int(value))
        notify_slack_action_confirmation(user=user, text="WhatIf question rejected.")
        return
    if action_id == "staff_contact_ack":
        acknowledge_contact_message(staff_user=user, message_id=int(value))
        notify_slack_action_confirmation(user=user, text="Contact message marked read ✓")
        return


def _handle_block_actions(payload: dict) -> HttpResponse:
    actions = payload.get("actions") or []
    if not actions:
        return HttpResponse(status=200)
    action = actions[0]
    action_id = (action.get("action_id") or "").strip()
    value = _action_value(action)
    if not action_id or not value:
        return HttpResponse(status=200)

    user = _resolve_user_from_payload(payload)
    if not user:
        if action_id.startswith("closet_ask") or action_id == "closet_request_loan":
            channel_id = str((payload.get("channel") or {}).get("id") or "").strip()
            slack_user_id = str((payload.get("user") or {}).get("id") or "").strip()
            if channel_id and slack_user_id:
                slack_chat_post_ephemeral(
                    channel=channel_id,
                    user=slack_user_id,
                    text="Link your PondArbor account to use Closet in Slack.",
                )
        return HttpResponse(status=200)

    try:
        _run_action(user=user, action_id=action_id, value=value, payload=payload)
    except (ClosetActionError, FriendActionError, StaffActionError, WhatIfActionError, ContactActionError) as exc:
        notify_slack_action_confirmation(user=user, text=exc.message)
    except Exception:
        logger.exception("Slack interaction failed action_id=%s", action_id)
        notify_slack_action_confirmation(user=user, text="Something went wrong. Try again in PondArbor.")
    return HttpResponse(status=200)


@csrf_exempt
@require_POST
def slack_interactions(request):
    raw_body = request.body
    if not verify_slack_request_signature(
        body=raw_body,
        timestamp=request.headers.get("X-Slack-Request-Timestamp"),
        signature=request.headers.get("X-Slack-Signature"),
    ):
        return HttpResponseForbidden("invalid signature")

    try:
        params = dict(parse_qsl(raw_body.decode("utf-8"), strict_parsing=False))
    except UnicodeDecodeError:
        return HttpResponse(status=400)

    payload_raw = params.get("payload") or ""
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    if payload.get("type") == "block_actions":
        return _handle_block_actions(payload)
    return HttpResponse(status=200)
