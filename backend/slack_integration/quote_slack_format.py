"""Format PondArbor quotes for Slack slash-command responses."""

from __future__ import annotations

from quotes.models import Quote, QuoteLabel

_MAX_SLACK_TEXT = 3000


def _owner_display_label(owner) -> str:
    username = (getattr(owner, "username", None) or "").strip()
    if username:
        return username
    return (getattr(owner, "email", None) or "").strip() or "someone"


def format_random_quote_slack_message(quote: Quote) -> str:
    body = (quote.body or "").strip()
    if len(body) > _MAX_SLACK_TEXT:
        body = body[: _MAX_SLACK_TEXT - 1] + "…"

    lines = [":scroll: *Random quote*", f">{body}"]

    attributions = [
        (label.name or "").strip()
        for label in quote.labels.all()
        if label.kind == QuoteLabel.Kind.ATTRIBUTION and (label.name or "").strip()
    ]
    if attributions:
        lines.append(f"— {', '.join(attributions)}")

    lines.append(f"_Collected by {_owner_display_label(quote.owner)} on PondArbor_")
    return "\n".join(lines)
