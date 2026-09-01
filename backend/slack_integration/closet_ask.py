"""#closet Slack request creation and interactive follow-ups."""

from __future__ import annotations

import logging

from django.conf import settings
from django.utils import timezone

from closet.actions import (
    ClosetActionError,
    create_borrow_request,
    create_closet_item,
    offer_loan_from_ask,
)
from closet.models import ClosetChannelAsk, ClosetChannelAskOffer, Item
from closet.services import owner_eligible_for_closet_publication_q
from closet.slack_ask_parse import (
    parse_request_command_text,
    score_closet_items_for_query,
)
from closet.slack_hooks import schedule_closet_slack_notify
from closet.slack_notify import (
    build_ask_match_blocks,
    build_crowd_ask_blocks,
    build_i_do_picker_blocks,
    build_now_in_closet_blocks,
    build_offer_loan_blocks,
    closet_user_label,
    notify_borrow_request_approved_to_requester,
    notify_borrow_request_to_owner,
    notify_slack_action_confirmation,
)
from friends.services import are_friends, friend_ids_for_user
from slack_integration.notify import notify_pondarbor_user_dm
from slack_integration.slack_api import slack_chat_post_ephemeral, slack_chat_post_message
from slack_integration.slack_ids import normalize_slack_channel_id
from users.models import User

logger = logging.getLogger(__name__)


def closet_channel_id() -> str:
    return normalize_slack_channel_id(getattr(settings, "SLACK_CLOSET_CHANNEL_ID", None) or "")


def create_slash_closet_request(
    *,
    user: User,
    team_id: str,
    command_text: str,
    closet_channel: str,
) -> tuple[ClosetChannelAsk, list[Item], list[dict], str]:
    """Create a channel ask from `/request` and DM any friend-closet matches."""
    item_query, quantity = parse_request_command_text(command_text)
    raw_text = (command_text or "").strip()[:4000]
    ask = ClosetChannelAsk.objects.create(
        requester_user=user,
        item_query=item_query[:255],
        quantity=quantity,
        raw_text=raw_text,
        date_needed_by=timezone.localdate(),
        slack_team_id=team_id[:32],
        slack_channel_id=closet_channel[:32],
        slack_message_ts="",
        status=ClosetChannelAsk.Status.OPEN,
    )
    matches = _friend_matches_for_ask(user=user, query=ask.item_query)
    if matches:
        blocks, summary = build_ask_match_blocks(ask=ask, items=matches)
        notify_pondarbor_user_dm(user, text=summary, blocks=blocks, rate="immediate")
    crowd_blocks, crowd_text = build_crowd_ask_blocks(ask=ask)
    logger.info(
        "closet slash request ask_id=%s matches=%s query=%r",
        ask.id,
        len(matches),
        ask.item_query,
    )
    return ask, matches, crowd_blocks, crowd_text


def record_crowd_prompt_ts(ask: ClosetChannelAsk, posted: dict) -> None:
    if not posted.get("ok"):
        return
    prompt_ts = str(posted.get("ts") or "").strip()
    if not prompt_ts:
        return
    ask.slack_prompt_ts = prompt_ts[:32]
    ask.save(update_fields=["slack_prompt_ts", "updated_at"])


def post_crowd_ask_to_closet(*, ask: ClosetChannelAsk, blocks: list[dict], text: str) -> dict:
    posted = slack_chat_post_message(
        channel=ask.slack_channel_id,
        text=text,
        blocks=blocks,
    )
    if posted.get("ok"):
        record_crowd_prompt_ts(ask, posted)
        return posted
    logger.warning("closet request crowd post failed: %s", posted)
    return posted


def handle_request_loan(*, user: User, ask_id: int, item_id: int) -> None:
    ask = _get_ask(ask_id)
    item = _get_item(item_id)
    message = _borrow_message_for_ask(ask)
    row, was_update = create_borrow_request(
        user=user,
        item=item,
        date_needed_by=ask.date_needed_by,
        message=message,
    )
    schedule_closet_slack_notify(
        notify_borrow_request_to_owner,
        row=row,
        is_update=was_update,
    )
    notify_slack_action_confirmation(
        user=user,
        text=f"Request sent to {closet_user_label(item.owner_user)}.",
    )


def handle_i_dont(*, user: User, ask_id: int, channel_id: str, slack_user_id: str) -> None:
    _get_ask(ask_id)
    if channel_id and slack_user_id:
        slack_chat_post_ephemeral(channel=channel_id, user=slack_user_id, text="Thanks for replying!")
        return
    notify_slack_action_confirmation(user=user, text="Thanks for replying!")


def handle_i_do(*, user: User, ask_id: int) -> None:
    ask = _get_ask(ask_id)
    if ask.requester_user_id == user.id:
        raise ClosetActionError("That's your own request.")
    existing = (
        ClosetChannelAskOffer.objects.filter(ask=ask, owner_user=user)
        .select_related("item", "ask__requester_user__profile")
        .first()
    )
    if existing:
        _send_offer_dm(user, existing)
        return
    _announce_i_do_in_channel(ask=ask, user=user)
    owned = _owned_items(user)
    close = score_closet_items_for_query(ask.item_query, owned)
    if close:
        blocks, text = build_i_do_picker_blocks(ask=ask, items=close)
        notify_pondarbor_user_dm(user, text=text, blocks=blocks, rate="immediate")
        return
    _create_item_and_offer(user=user, ask=ask)


def handle_pick_item(*, user: User, ask_id: int, item_id: int) -> None:
    ask = _get_ask(ask_id)
    if ask.requester_user_id == user.id:
        raise ClosetActionError("That's your own request.")
    item = _get_item(item_id)
    if item.owner_user_id != user.id:
        raise ClosetActionError("You can only offer items you own.")
    existing = ClosetChannelAskOffer.objects.filter(ask=ask, owner_user=user).select_related("item").first()
    if existing:
        _send_offer_dm(user, existing)
        return
    offer = ClosetChannelAskOffer.objects.create(
        ask=ask,
        owner_user=user,
        item=item,
        created_item=False,
    )
    _send_offer_dm(user, offer)
    _notify_requester_now_in_closet(ask, item)


def handle_create_item(*, user: User, ask_id: int) -> None:
    ask = _get_ask(ask_id)
    if ask.requester_user_id == user.id:
        raise ClosetActionError("That's your own request.")
    existing = ClosetChannelAskOffer.objects.filter(ask=ask, owner_user=user).select_related("item").first()
    if existing:
        _send_offer_dm(user, existing)
        return
    _create_item_and_offer(user=user, ask=ask)


def handle_offer_yes(*, user: User, offer_id: int) -> None:
    offer = _get_offer(offer_id)
    if offer.owner_user_id != user.id:
        raise ClosetActionError("Only the person who offered can confirm.", status_code=403)
    ask = offer.ask
    item = offer.item
    if not are_friends(user_a=user, user_b=ask.requester_user):
        who = closet_user_label(ask.requester_user)
        raise ClosetActionError(
            f"You're not friends with {who} on PondArbor yet. "
            "Send a friend request, then offer the loan from Closet."
        )
    row, loan = offer_loan_from_ask(owner=user, ask=ask, item=item)
    if loan:
        schedule_closet_slack_notify(notify_borrow_request_approved_to_requester, loan=loan)
        notify_slack_action_confirmation(user=user, text="Loan started ✓")
        return
    notify_slack_action_confirmation(
        user=user,
        text="Item is currently loaned. A pending request was created instead.",
    )
    pending_text = (
        f":coat: *Closet* — {closet_user_label(user)} offered *{item.name}*, "
        f"but it's currently loaned. Your request is pending."
    )
    notify_pondarbor_user_dm(ask.requester_user, text=pending_text, rate="immediate")


def handle_offer_no(*, user: User, offer_id: int) -> None:
    offer = _get_offer(offer_id)
    if offer.owner_user_id != user.id:
        raise ClosetActionError("Only the person who offered can dismiss this.", status_code=403)
    if offer.created_item:
        notify_slack_action_confirmation(user=user, text="Okay — the item stays in your closet.")
        return
    notify_slack_action_confirmation(user=user, text="Okay.")


def _create_item_and_offer(*, user: User, ask: ClosetChannelAsk) -> ClosetChannelAskOffer:
    item = create_closet_item(
        user=user,
        name=ask.item_query,
        description=_new_item_description(ask),
    )
    offer = ClosetChannelAskOffer.objects.create(
        ask=ask,
        owner_user=user,
        item=item,
        created_item=True,
    )
    _send_offer_dm(user, offer)
    _notify_requester_now_in_closet(ask, item)
    return offer


def _announce_i_do_in_channel(*, ask: ClosetChannelAsk, user: User) -> None:
    channel = (ask.slack_channel_id or "").strip()
    if not channel:
        return
    who = closet_user_label(user)
    text = f"*{who}* says they have *{ask.item_query}*."
    thread_ts = (ask.slack_prompt_ts or ask.slack_message_ts or "").strip() or None
    posted = slack_chat_post_message(
        channel=channel,
        text=text,
        thread_ts=thread_ts,
        reply_broadcast=bool(thread_ts),
    )
    if not posted.get("ok"):
        logger.warning("closet i_do channel notice failed: %s", posted)


def _send_offer_dm(user: User, offer: ClosetChannelAskOffer) -> None:
    ask = offer.ask
    blocks, text = build_offer_loan_blocks(ask=ask, item=offer.item, offer_id=offer.id)
    notify_pondarbor_user_dm(user, text=text, blocks=blocks, rate="immediate")


def _notify_requester_now_in_closet(ask: ClosetChannelAsk, item: Item) -> None:
    can_request = are_friends(user_a=ask.requester_user, user_b=item.owner_user)
    blocks, text = build_now_in_closet_blocks(ask=ask, item=item, can_request=can_request)
    notify_pondarbor_user_dm(ask.requester_user, text=text, blocks=blocks, rate="immediate")


def _friend_matches_for_ask(*, user: User, query: str) -> list[Item]:
    friend_ids = friend_ids_for_user(user=user)
    if not friend_ids:
        return []
    items = list(
        Item.objects.filter(deleted_at__isnull=True)
        .filter(owner_eligible_for_closet_publication_q())
        .filter(owner_user_id__in=friend_ids)
        .exclude(owner_user=user)
        .select_related("owner_user__profile", "current_holder_user__profile")
    )
    return score_closet_items_for_query(query, items) if (query or "").strip() else []


def _owned_items(user: User) -> list[Item]:
    return list(
        Item.objects.filter(deleted_at__isnull=True, owner_user=user)
        .filter(owner_eligible_for_closet_publication_q())
        .select_related("owner_user__profile", "current_holder_user__profile")
    )


def _borrow_message_for_ask(ask: ClosetChannelAsk) -> str:
    parts = [f"From Slack: {ask.raw_text.strip()}"]
    if ask.quantity:
        parts.append(f"Requested quantity: {ask.quantity}")
    return "\n".join(parts)


def _new_item_description(ask: ClosetChannelAsk) -> str:
    parts = []
    if ask.quantity:
        parts.append(f"Requested quantity: {ask.quantity}")
    if ask.raw_text.strip():
        parts.append(f"From Slack: {ask.raw_text.strip()}")
    return "\n".join(parts)


def _get_ask(ask_id: int) -> ClosetChannelAsk:
    ask = (
        ClosetChannelAsk.objects.select_related("requester_user__profile")
        .filter(pk=ask_id)
        .first()
    )
    if not ask:
        raise ClosetActionError("That request is no longer available.")
    return ask


def _get_item(item_id: int) -> Item:
    item = (
        Item.objects.filter(deleted_at__isnull=True, pk=item_id)
        .select_related("owner_user__profile", "current_holder_user__profile")
        .first()
    )
    if not item:
        raise ClosetActionError("That item is no longer available.")
    return item


def _get_offer(offer_id: int) -> ClosetChannelAskOffer:
    offer = (
        ClosetChannelAskOffer.objects.select_related(
            "ask__requester_user__profile",
            "item__owner_user__profile",
            "owner_user",
        )
        .filter(pk=offer_id)
        .first()
    )
    if not offer:
        raise ClosetActionError("That offer is no longer available.")
    return offer
