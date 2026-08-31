"""Closet Slack DM copy, Block Kit builders, and proactive notification dispatch."""

from __future__ import annotations

import logging
from datetime import date, datetime
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q

from closet.models import BorrowRequest, ClosetChannelAsk, Item, Loan
from closet.serializers import _user_summary
from closet.services import item_fk_owner_publication_eligible_q, owner_eligible_for_closet_publication_q
from slack_integration.dm_queue import (
    EVENT_CLOSET_BORROW_REQUEST,
    EVENT_CLOSET_CUSTODY_OFFER,
    ref_borrow_request,
    ref_item,
)
from slack_integration.notify import notify_pondarbor_user_dm

logger = logging.getLogger(__name__)

User = get_user_model()

MAX_SLACK_BLOCKS = 40
_TRUNCATION_NOTE = "_Showing the first items — open PondArbor for the full list._"


def pondarbor_origin() -> str:
    return (getattr(settings, "PONDARBOR_ORIGIN", None) or "https://www.pondarbor.com").strip().rstrip("/")


def closet_item_url(item_id: int) -> str:
    return f"{pondarbor_origin()}/closet?tab=items&item={item_id}"


def closet_home_url() -> str:
    return f"{pondarbor_origin()}/closet?tab=items"


def closet_search_url(query: str) -> str:
    q = quote((query or "").strip())
    return f"{pondarbor_origin()}/closet?tab=items&q={q}"


def closet_user_label(user) -> str:
    summary = _user_summary(user)
    return summary["display_name"] or summary["email"] or f"User {user.id}"


def _format_date(value: date | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _section(text: str) -> dict:
    return {"type": "section", "text": {"type": "mrkdwn", "text": text}}


def _divider() -> dict:
    return {"type": "divider"}


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


def _actions_row(*elements) -> dict:
    return {"type": "actions", "elements": list(elements)[:5]}


def _append_blocks(blocks: list[dict], new_blocks: list[dict], *, limit: int = MAX_SLACK_BLOCKS) -> bool:
    """Append blocks; return True if truncated."""
    remaining = limit - len(blocks)
    if remaining <= 0:
        return True
    if len(new_blocks) <= remaining:
        blocks.extend(new_blocks)
        return len(blocks) >= limit
    blocks.extend(new_blocks[: max(0, remaining - 1)])
    blocks.append(_section(_TRUNCATION_NOTE))
    blocks.append(_actions_row(_link_button(text="Open Closet", url=closet_home_url())))
    return True


def _visible_borrow_requests():
    return BorrowRequest.objects.filter(deleted_at__isnull=True)


def _visible_loans():
    return Loan.objects.filter(deleted_at__isnull=True)


def _item_queryset():
    return (
        Item.objects.filter(deleted_at__isnull=True)
        .filter(owner_eligible_for_closet_publication_q())
        .select_related(
            "owner_user__profile",
            "current_holder_user__profile",
            "custody_pending_acceptance_user__profile",
        )
    )


def _active_loan_ids_for_items(item_ids: list[int]) -> dict[int, Loan]:
    if not item_ids:
        return {}
    rows = _visible_loans().filter(
        item_id__in=item_ids,
        status=Loan.Status.ACTIVE,
    ).select_related("borrower_user__profile", "owner_user__profile")
    return {int(row.item_id): row for row in rows}


def _row_with_open_link(*, line: str, item_id: int, buttons: list[dict]) -> list[dict]:
    out = [_section(line)]
    elements = buttons + [_link_button(text="Open in PondArbor", url=closet_item_url(item_id))]
    out.append(_actions_row(*elements))
    return out


# --- Proactive event DMs ---


def notify_borrow_request_to_owner(*, row: BorrowRequest, is_update: bool) -> None:
    row = (
        _visible_borrow_requests()
        .select_related("item", "requester_user__profile", "item__owner_user")
        .get(pk=row.pk)
    )
    prefix = "Updated request — " if is_update else ""
    msg_parts = [
        f":coat: *Closet* — {prefix}{closet_user_label(row.requester_user)} requested to borrow *{row.item.name}*.",
        f"Needed by {_format_date(row.date_needed_by)}.",
    ]
    if row.message.strip():
        msg_parts.append(f"_{row.message.strip()}_")
    text = "\n".join(msg_parts)
    blocks = _row_with_open_link(
        line=text,
        item_id=row.item_id,
        buttons=[
            _action_button(action_id="closet_approve", text="Approve", value=str(row.id), style="primary"),
            _action_button(action_id="closet_decline", text="Decline", value=str(row.id)),
        ],
    )
    notify_pondarbor_user_dm(
        row.item.owner_user,
        text=text,
        blocks=blocks,
        event_type=EVENT_CLOSET_BORROW_REQUEST,
        ref_key=ref_borrow_request(row.id),
    )


def notify_borrow_request_canceled_to_owner(*, row: BorrowRequest) -> None:
    row = _visible_borrow_requests().select_related("item", "requester_user__profile", "item__owner_user").get(pk=row.pk)
    text = (
        f":coat: *Closet* — {closet_user_label(row.requester_user)} canceled their request "
        f"to borrow *{row.item.name}*."
    )
    blocks = _row_with_open_link(line=text, item_id=row.item_id, buttons=[])
    notify_pondarbor_user_dm(row.item.owner_user, text=text, blocks=blocks)


def notify_borrow_request_approved_to_requester(*, loan: Loan) -> None:
    loan = _visible_loans().select_related("item", "borrower_user", "owner_user").get(pk=loan.pk)
    text = f":white_check_mark: *Closet* — {closet_user_label(loan.owner_user)} approved your borrow of *{loan.item.name}*."
    blocks = _row_with_open_link(line=text, item_id=loan.item_id, buttons=[])
    notify_pondarbor_user_dm(loan.borrower_user, text=text, blocks=blocks)


def notify_borrow_request_declined_to_requester(*, row: BorrowRequest) -> None:
    row = _visible_borrow_requests().select_related("item", "requester_user", "item__owner_user").get(pk=row.pk)
    text = f":coat: *Closet* — {closet_user_label(row.item.owner_user)} declined your request for *{row.item.name}*."
    if row.decline_message.strip():
        text += f"\n_{row.decline_message.strip()}_"
    blocks = _row_with_open_link(line=text, item_id=row.item_id, buttons=[])
    notify_pondarbor_user_dm(row.requester_user, text=text, blocks=blocks)


def notify_loan_marked_returned_to_owner(*, loan: Loan) -> None:
    loan = _visible_loans().select_related("item", "borrower_user", "owner_user").get(pk=loan.pk)
    text = (
        f":package: *Closet* — {closet_user_label(loan.borrower_user)} marked *{loan.item.name}* "
        f"ready to return."
    )
    blocks = _row_with_open_link(
        line=text,
        item_id=loan.item_id,
        buttons=[
            _action_button(action_id="closet_confirm_loan", text="Confirm return", value=str(loan.id), style="primary"),
        ],
    )
    notify_pondarbor_user_dm(loan.owner_user, text=text, blocks=blocks)


def notify_custody_marked_returned_to_owner(*, item: Item) -> None:
    item = _item_queryset().get(pk=item.pk)
    text = (
        f":package: *Closet* — {closet_user_label(item.current_holder_user)} marked *{item.name}* "
        f"ready to return."
    )
    blocks = _row_with_open_link(
        line=text,
        item_id=item.id,
        buttons=[
            _action_button(action_id="closet_confirm_custody", text="Confirm return", value=str(item.id), style="primary"),
        ],
    )
    notify_pondarbor_user_dm(item.owner_user, text=text, blocks=blocks)


def notify_loan_return_completed_to_borrower(*, loan: Loan) -> None:
    loan = _visible_loans().select_related("item", "borrower_user", "owner_user").get(pk=loan.pk)
    text = (
        f":white_check_mark: *Closet* — *{loan.item.name}* — "
        f"{closet_user_label(loan.owner_user)} confirmed your return. Thanks!"
    )
    blocks = _row_with_open_link(line=text, item_id=loan.item_id, buttons=[])
    notify_pondarbor_user_dm(loan.borrower_user, text=text, blocks=blocks)


def notify_custody_return_completed_to_holder(*, item: Item, holder: User) -> None:
    item = _item_queryset().select_related("owner_user").get(pk=item.pk)
    text = (
        f":white_check_mark: *Closet* — *{item.name}* — "
        f"{closet_user_label(item.owner_user)} confirmed you returned it."
    )
    blocks = _row_with_open_link(line=text, item_id=item.id, buttons=[])
    notify_pondarbor_user_dm(holder, text=text, blocks=blocks)


def notify_custody_dispute_to_owner(*, item: Item) -> None:
    item = _item_queryset().select_related("owner_user", "current_holder_user").get(pk=item.pk)
    text = (
        f":warning: *Closet* — {closet_user_label(item.current_holder_user)} disputed custody of *{item.name}*. "
        f"Open PondArbor to resolve."
    )
    blocks = _row_with_open_link(line=text, item_id=item.id, buttons=[])
    notify_pondarbor_user_dm(item.owner_user, text=text, blocks=blocks)


def notify_custody_offer_to_holder(*, item: Item, holder: User) -> None:
    item = _item_queryset().select_related("owner_user").get(pk=item.pk)
    text = (
        f":coat: *Closet* — {closet_user_label(item.owner_user)} offered you custody of *{item.name}*."
    )
    blocks = _row_with_open_link(
        line=text,
        item_id=item.id,
        buttons=[
            _action_button(action_id="closet_accept_custody", text="Accept", value=str(item.id), style="primary"),
            _action_button(action_id="closet_reject_custody", text="Decline", value=str(item.id)),
        ],
    )
    notify_pondarbor_user_dm(
        holder,
        text=text,
        blocks=blocks,
        event_type=EVENT_CLOSET_CUSTODY_OFFER,
        ref_key=ref_item(item.id),
    )


def notify_custody_offer_rejected_to_owner(*, item: Item, holder: User) -> None:
    item = _item_queryset().select_related("owner_user").get(pk=item.pk)
    text = f":coat: *Closet* — {closet_user_label(holder)} declined your custody offer for *{item.name}*."
    blocks = _row_with_open_link(line=text, item_id=item.id, buttons=[])
    notify_pondarbor_user_dm(item.owner_user, text=text, blocks=blocks)


def notify_custody_offer_canceled_to_holder(*, item: Item, holder: User) -> None:
    item = _item_queryset().select_related("owner_user").get(pk=item.pk)
    text = f":coat: *Closet* — {closet_user_label(item.owner_user)} canceled the custody offer for *{item.name}*."
    blocks = _row_with_open_link(line=text, item_id=item.id, buttons=[])
    notify_pondarbor_user_dm(holder, text=text, blocks=blocks)


def notify_slack_action_confirmation(*, user: User, text: str) -> None:
    notify_pondarbor_user_dm(user, text=text, rate="immediate")


# --- Slash command block builders ---


def build_pending_requests_footer_blocks(user: User) -> list[dict]:
    borrowed_ids = set(
        _item_queryset()
        .filter(current_holder_user=user)
        .exclude(owner_user=user)
        .values_list("id", flat=True)
    )
    custody_offered_ids = set(
        _item_queryset()
        .filter(custody_pending_acceptance_user=user)
        .exclude(owner_user=user)
        .values_list("id", flat=True)
    )
    rows = (
        _visible_borrow_requests()
        .filter(
            requester_user=user,
            status=BorrowRequest.Status.PENDING,
            item__deleted_at__isnull=True,
        )
        .filter(item_fk_owner_publication_eligible_q())
        .select_related("item", "item__owner_user__profile")
        .order_by("date_needed_by", "-created_at")
    )
    blocks: list[dict] = []
    any_row = False
    for row in rows:
        if row.item_id in borrowed_ids or row.item_id in custody_offered_ids:
            continue
        if not any_row:
            blocks.append(_section("*Waiting on others*"))
            any_row = True
        line = (
            f"• *{row.item.name}* — requested from {closet_user_label(row.item.owner_user)}, "
            f"needed by {_format_date(row.date_needed_by)}"
        )
        if row.message.strip():
            line += f'\n  _"{row.message.strip()}"_'
        _append_blocks(blocks, _row_with_open_link(line=line, item_id=row.item_id, buttons=[]))
    return blocks


def build_closet_inbox_blocks(user: User) -> tuple[list[dict], str]:
    blocks: list[dict] = [_section(":coat: *Closet inbox*")]
    truncated = False

    incoming = (
        _visible_borrow_requests()
        .filter(
            status=BorrowRequest.Status.PENDING,
            item__owner_user=user,
            item__deleted_at__isnull=True,
        )
        .select_related("item", "requester_user__profile")
        .order_by("date_needed_by", "-created_at")
    )
    for row in incoming:
        line = (
            f"*{row.item.name}* — borrow request from {closet_user_label(row.requester_user)} "
            f"(needed by {_format_date(row.date_needed_by)})"
        )
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=row.item_id,
                buttons=[
                    _action_button(action_id="closet_approve", text="Approve", value=str(row.id), style="primary"),
                    _action_button(action_id="closet_decline", text="Decline", value=str(row.id)),
                ],
            ),
        ) or truncated

    custody_offers = (
        _item_queryset()
        .filter(custody_pending_acceptance_user=user)
        .exclude(owner_user=user)
        .order_by("-updated_at")
    )
    for item in custody_offers:
        line = f"*{item.name}* — custody offer from {closet_user_label(item.owner_user)}"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=item.id,
                buttons=[
                    _action_button(action_id="closet_accept_custody", text="Accept", value=str(item.id), style="primary"),
                    _action_button(action_id="closet_reject_custody", text="Decline", value=str(item.id)),
                ],
            ),
        ) or truncated

    loan_returns = (
        _visible_loans()
        .filter(
            status=Loan.Status.ACTIVE,
            owner_user=user,
            marked_returned_by_borrower_at__isnull=False,
            item__deleted_at__isnull=True,
        )
        .select_related("item", "borrower_user__profile")
        .order_by("-marked_returned_by_borrower_at")
    )
    for loan in loan_returns:
        line = f"*{loan.item.name}* — {closet_user_label(loan.borrower_user)} marked returned (loan)"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=loan.item_id,
                buttons=[
                    _action_button(action_id="closet_confirm_loan", text="Confirm return", value=str(loan.id), style="primary"),
                ],
            ),
        ) or truncated

    active_loan_exists = Loan.objects.filter(
        item_id=OuterRef("pk"),
        status=Loan.Status.ACTIVE,
        deleted_at__isnull=True,
    )
    custody_returns = (
        Item.objects.filter(
            owner_user=user,
            deleted_at__isnull=True,
            custody_marked_returned_by_holder_at__isnull=False,
        )
        .annotate(_has_active_loan=Exists(active_loan_exists))
        .filter(_has_active_loan=False)
        .select_related("current_holder_user__profile")
        .order_by("-custody_marked_returned_by_holder_at")
    )
    for item in custody_returns:
        line = f"*{item.name}* — {closet_user_label(item.current_holder_user)} marked returned (custody)"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=item.id,
                buttons=[
                    _action_button(action_id="closet_confirm_custody", text="Confirm return", value=str(item.id), style="primary"),
                ],
            ),
        ) or truncated

    disputes = Item.objects.filter(owner_user=user, deleted_at__isnull=True, custody_disputed=True).select_related(
        "current_holder_user__profile"
    )
    for item in disputes:
        line = f"*{item.name}* — custody dispute with {closet_user_label(item.current_holder_user)}"
        truncated = _append_blocks(blocks, _row_with_open_link(line=line, item_id=item.id, buttons=[])) or truncated

    my_loans = (
        _visible_loans()
        .filter(status=Loan.Status.ACTIVE, borrower_user=user)
        .select_related("item", "owner_user__profile")
        .order_by("-checkout_at")
    )
    for loan in my_loans:
        if loan.marked_returned_by_borrower_at:
            continue
        line = f"*{loan.item.name}* — you are borrowing from {closet_user_label(loan.owner_user)}"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=loan.item_id,
                buttons=[
                    _action_button(action_id="closet_mark_loan_returned", text="I returned this", value=str(loan.id)),
                ],
            ),
        ) or truncated

    my_custody = (
        _item_queryset()
        .filter(current_holder_user=user)
        .exclude(owner_user=user)
        .order_by("-updated_at")
    )
    loan_by_item = _active_loan_ids_for_items(list(my_custody.values_list("id", flat=True)))
    for item in my_custody:
        if item.id in loan_by_item or item.custody_marked_returned_by_holder_at:
            continue
        line = f"*{item.name}* — you hold this for {closet_user_label(item.owner_user)} (custody)"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=item.id,
                buttons=[
                    _action_button(action_id="closet_mark_custody_returned", text="I returned this", value=str(item.id)),
                ],
            ),
        ) or truncated

    footer = build_pending_requests_footer_blocks(user)
    if footer:
        truncated = _append_blocks(blocks, [_divider()] + footer) or truncated

    if len(blocks) == 1 and not footer:
        text = "Nothing pending in Closet."
        blocks.append(_actions_row(_link_button(text="Open Closet", url=closet_home_url())))
        return blocks, text

    blocks.append(_actions_row(_link_button(text="Open Closet", url=closet_home_url())))
    return blocks, "Your Closet inbox."


def build_loans_summary_blocks(user: User) -> tuple[list[dict], str]:
    blocks: list[dict] = [_section(":handshake: *Loans & holdings*")]
    truncated = False
    has_any = False

    lent_loans = list(
        _visible_loans()
        .filter(status=Loan.Status.ACTIVE, owner_user=user)
        .select_related("item", "borrower_user__profile")
        .order_by("-checkout_at")
    )
    lent_loan_item_ids = {loan.item_id for loan in lent_loans}
    lent_custody = list(
        _item_queryset()
        .filter(owner_user=user)
        .exclude(current_holder_user=user)
        .exclude(id__in=lent_loan_item_ids)
        .order_by("-updated_at")
    )
    if lent_loans or lent_custody:
        blocks.append(_section("*Out with friends*"))
        has_any = True
    for loan in lent_loans:
        line = f"• *{loan.item.name}* — with {closet_user_label(loan.borrower_user)} (loan) since {_format_date(loan.checkout_at)}"
        buttons: list[dict] = []
        if loan.marked_returned_by_borrower_at:
            line += "\nBorrower marked returned"
            buttons.append(
                _action_button(action_id="closet_confirm_loan", text="Confirm return", value=str(loan.id), style="primary")
            )
        truncated = _append_blocks(blocks, _row_with_open_link(line=line, item_id=loan.item_id, buttons=buttons)) or truncated

    for item in lent_custody:
        line = f"• *{item.name}* — with {closet_user_label(item.current_holder_user)} (custody)"
        buttons = []
        if item.custody_marked_returned_by_holder_at:
            line += "\nHolder marked returned"
            buttons.append(
                _action_button(action_id="closet_confirm_custody", text="Confirm return", value=str(item.id), style="primary")
            )
        truncated = _append_blocks(blocks, _row_with_open_link(line=line, item_id=item.id, buttons=buttons)) or truncated

    with_rows_started = False
    borrowing_loans = (
        _visible_loans()
        .filter(status=Loan.Status.ACTIVE, borrower_user=user)
        .select_related("item", "owner_user__profile")
        .order_by("-checkout_at")
    )
    loan_item_ids = set()
    for loan in borrowing_loans:
        if not with_rows_started:
            blocks.append(_section("*With friends*"))
            with_rows_started = True
            has_any = True
        loan_item_ids.add(loan.item_id)
        line = f"• *{loan.item.name}* — from {closet_user_label(loan.owner_user)} (loan) since {_format_date(loan.checkout_at)}"
        buttons = []
        if loan.marked_returned_by_borrower_at:
            line += "\nWaiting for owner to confirm"
        else:
            buttons.append(
                _action_button(action_id="closet_mark_loan_returned", text="I returned this", value=str(loan.id))
            )
        truncated = _append_blocks(blocks, _row_with_open_link(line=line, item_id=loan.item_id, buttons=buttons)) or truncated

    holding = (
        _item_queryset()
        .filter(current_holder_user=user)
        .exclude(owner_user=user)
        .order_by("-updated_at")
    )
    for item in holding:
        if item.id in loan_item_ids:
            continue
        if not with_rows_started:
            blocks.append(_section("*With friends*"))
            with_rows_started = True
            has_any = True
        line = f"• *{item.name}* — from {closet_user_label(item.owner_user)} (custody)"
        buttons = []
        if item.custody_marked_returned_by_holder_at:
            line += "\nWaiting for owner to confirm"
        else:
            buttons.append(
                _action_button(action_id="closet_mark_custody_returned", text="I returned this", value=str(item.id))
            )
        truncated = _append_blocks(blocks, _row_with_open_link(line=line, item_id=item.id, buttons=buttons)) or truncated

    pending_offers = (
        _item_queryset()
        .filter(custody_pending_acceptance_user=user)
        .exclude(owner_user=user)
        .order_by("-updated_at")
    )
    for item in pending_offers:
        if not with_rows_started:
            blocks.append(_section("*With friends*"))
            with_rows_started = True
            has_any = True
        line = f"• *{item.name}* — from {closet_user_label(item.owner_user)} (custody offer pending)"
        truncated = _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=item.id,
                buttons=[
                    _action_button(action_id="closet_accept_custody", text="Accept", value=str(item.id), style="primary"),
                    _action_button(action_id="closet_reject_custody", text="Decline", value=str(item.id)),
                ],
            ),
        ) or truncated

    if not has_any:
        blocks.append(_section("Nothing out on loan or in your possession right now."))

    footer = build_pending_requests_footer_blocks(user)
    if footer:
        truncated = _append_blocks(blocks, [_divider()] + footer) or truncated

    blocks.append(_actions_row(_link_button(text="Open Closet", url=closet_home_url())))
    return blocks, "Your loans and holdings summary."


def _item_loaned_suffix(item: Item) -> str:
    from closet.actions import item_is_loaned

    return " (loaned)" if item_is_loaned(item) else ""


def build_ask_match_blocks(*, ask: ClosetChannelAsk, items: list[Item]) -> tuple[list[dict], str]:
    text = f":coat: *Closet* — we have matches for *{ask.item_query}*."
    blocks: list[dict] = [_section(text)]
    for item in items:
        line = f"*{item.name}* — {closet_user_label(item.owner_user)}{_item_loaned_suffix(item)}"
        _append_blocks(
            blocks,
            _row_with_open_link(
                line=line,
                item_id=item.id,
                buttons=[
                    _action_button(
                        action_id="closet_request_loan",
                        text="Request loan",
                        value=f"{ask.id}:{item.id}",
                        style="primary",
                    )
                ],
            ),
        )
    blocks.append(_actions_row(_link_button(text="Open matching items", url=closet_search_url(ask.item_query))))
    return blocks, text


def build_crowd_ask_blocks(*, ask: ClosetChannelAsk) -> tuple[list[dict], str]:
    qty = f" ({ask.quantity})" if ask.quantity else ""
    who = closet_user_label(ask.requester_user)
    text = f":coat: *{who}* is looking for *{ask.item_query}*{qty}. Anyone have one?"
    blocks = [
        _section(text),
        _actions_row(
            _action_button(action_id="closet_ask_i_do", text="I Do!", value=str(ask.id), style="primary"),
            _action_button(action_id="closet_ask_i_dont", text="I Don't", value=str(ask.id)),
        ),
    ]
    return blocks, text


def build_i_do_picker_blocks(*, ask: ClosetChannelAsk, items: list[Item]) -> tuple[list[dict], str]:
    text = f"Pick an existing item to offer as *{ask.item_query}*, or create a new listing."
    options = []
    for item in items:
        label = f"{item.name}{_item_loaned_suffix(item)}"[:75]
        options.append(
            {
                "text": {"type": "plain_text", "text": label or "Item"},
                "value": f"{ask.id}:{item.id}",
            }
        )
    elements: list[dict] = []
    if options:
        elements.append(
            {
                "type": "static_select",
                "action_id": "closet_ask_pick_item",
                "placeholder": {"type": "plain_text", "text": "Pick existing item"},
                "options": options,
            }
        )
    elements.append(
        _action_button(action_id="closet_ask_create_item", text="Create new item", value=str(ask.id))
    )
    return [_section(text), _actions_row(*elements)], text


def build_offer_loan_blocks(*, ask: ClosetChannelAsk, item: Item, offer_id: int) -> tuple[list[dict], str]:
    who = closet_user_label(ask.requester_user)
    text = f"Offer a loan of *{item.name}* to *{who}*?"
    blocks = [
        _section(text),
        _actions_row(
            _action_button(action_id="closet_offer_loan_yes", text="Yes", value=str(offer_id), style="primary"),
            _action_button(action_id="closet_offer_loan_no", text="No", value=str(offer_id)),
            _link_button(text="Open in PondArbor", url=closet_item_url(item.id)),
        ),
    ]
    return blocks, text


def build_now_in_closet_blocks(*, ask: ClosetChannelAsk, item: Item, can_request: bool) -> tuple[list[dict], str]:
    owner = closet_user_label(item.owner_user)
    text = (
        f":coat: *Closet* — *{item.name}* is now listed by {owner}"
        f"{_item_loaned_suffix(item)}."
    )
    buttons = []
    if can_request:
        buttons.append(
            _action_button(
                action_id="closet_request_loan",
                text="Request loan",
                value=f"{ask.id}:{item.id}",
                style="primary",
            )
        )
    blocks = _row_with_open_link(line=text, item_id=item.id, buttons=buttons)
    return blocks, text
