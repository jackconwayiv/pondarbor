"""Plain text from Slack message events (mrkdwn fallback or rich_text blocks)."""

from __future__ import annotations

import re

_MENTION_RE = re.compile(r"<@[UW][A-Z0-9]+(?:\|[^>]+)?>")
_SPECIAL_RE = re.compile(r"<!subteam[^>]+>|<!(?:here|channel|everyone)(?:\|[^>]+)?>", re.I)


def slack_event_plain_text(event: dict | None) -> str:
    ev = event or {}
    text = (ev.get("text") or "").strip()
    if not text:
        text = _text_from_blocks(ev.get("blocks") or [])
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = _MENTION_RE.sub(" ", text)
    text = _SPECIAL_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def _text_from_blocks(blocks) -> str:
    chunks: list[str] = []
    for block in blocks or []:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "rich_text":
            for el in block.get("elements") or []:
                chunks.extend(_rich_text_leaves(el))
        elif btype == "section":
            node = block.get("text") or {}
            if isinstance(node, dict):
                chunks.append(str(node.get("text") or ""))
    return " ".join(chunks)


def _rich_text_leaves(el: dict) -> list[str]:
    out: list[str] = []
    if not isinstance(el, dict):
        return out
    etype = el.get("type")
    if etype == "text":
        out.append(str(el.get("text") or ""))
    elif etype == "link":
        out.append(str(el.get("text") or el.get("url") or ""))
    elif etype in {"rich_text_section", "rich_text_preformatted", "rich_text_quote", "rich_text_list"}:
        for child in el.get("elements") or []:
            out.extend(_rich_text_leaves(child))
    return out
