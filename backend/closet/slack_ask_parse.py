"""Heuristic parser and close-match scorer for #closet Slack asks."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from difflib import SequenceMatcher

_WORD_QTY = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

_WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

_STOP = frozenset({"a", "an", "the", "some", "any", "of", "please", "pls"})
_PRONOUN_ITEMS = frozenset({"one", "it", "this", "that", "any", "some", "something", "anything"})

_TRAILING_HEDGE_RE = re.compile(
    r"\s+if\s+(?:any(?:one|body)|someone|somebody)\s+(?:has|have|got)\s+(?:one|it|any|some)\b.*$",
    re.I,
)

# Filler for inventory scans of the raw Slack message (not for extracted item phrases).
_SCAN_STOP = _STOP | frozenset(
    {
        "does",
        "do",
        "did",
        "can",
        "could",
        "may",
        "would",
        "anyone",
        "anybody",
        "someone",
        "somebody",
        "everyone",
        "everybody",
        "have",
        "has",
        "had",
        "got",
        "get",
        "getting",
        "i",
        "we",
        "you",
        "they",
        "my",
        "our",
        "your",
        "borrow",
        "borrowing",
        "loan",
        "loaning",
        "need",
        "needed",
        "looking",
        "request",
        "for",
        "from",
        "with",
        "about",
        "who",
        "what",
        "where",
        "when",
        "how",
        "to",
        "in",
        "on",
        "at",
        "by",
        "it",
        "this",
        "that",
        "and",
        "or",
        "but",
        "if",
        "so",
        "just",
        "also",
        "still",
        "very",
        "really",
        "love",
        "loved",
        "loves",
        "tho",
        "though",
        "thanks",
        "thank",
        "thx",
        "please",
        "pls",
        "hey",
        "hi",
        "hello",
        "ok",
        "okay",
        "yeah",
        "yes",
        "nope",
        "lol",
    }
)

_CHATTER_RE = re.compile(
    r"^\s*(?:thanks|thank you|thx|ty|cheers|good morning|good night|gm|gn|"
    r"lol|lmao|haha|ok|okay|sounds good|got it|never ?mind|nm)[\s!.]*$",
    re.I,
)
_NOT_ASK_RE = re.compile(
    r"\b(?:returned|returning|brought back|dropping off|dropped off)\b"
    r"|\blove\s+(?:this|that|it)\b",
    re.I,
)

# Unigram vs a multi-word item name: skip short generic overlaps like "table" → "table saw".
_UNIGRAM_MULTIWORD_MIN_LEN = 6
_UNIGRAM_MULTIWORD_MIN_FRAC = 0.7

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_COLLAPSE_RE = re.compile(r"[^a-z0-9]+")

_DATE_BY_ISO = re.compile(
    r"\b(?:needed\s+by|need\s+(?:it\s+)?by|by)\s+(\d{4}-\d{2}-\d{2})\b",
    re.I,
)
_DATE_BY_MDY = re.compile(
    r"\b(?:needed\s+by|need\s+(?:it\s+)?by|by)\s+(\d{1,2}/\d{1,2}(?:/\d{2,4})?)\b",
    re.I,
)
_DATE_BY_WEEKDAY = re.compile(
    r"\b(?:needed\s+by|need\s+(?:it\s+)?by|by)\s+(?:next\s+)?("
    + "|".join(_WEEKDAYS)
    + r")\b",
    re.I,
)
_DATE_BY_TOMORROW = re.compile(
    r"\b(?:needed\s+by|need\s+(?:it\s+)?by|by)\s+tomorrow\b",
    re.I,
)
_DATE_BY_TODAY = re.compile(
    r"\b(?:needed\s+by|need\s+(?:it\s+)?by|by)\s+today\b",
    re.I,
)

_QTY_TRAILING = re.compile(
    r"[.!?]\s*i\s+need\s+(\d+|" + "|".join(_WORD_QTY) + r")\b",
    re.I,
)
_QTY_NEED_N = re.compile(
    r"\bneed(?:ed)?\s+(\d+|" + "|".join(k for k in _WORD_QTY if k not in {"a", "an"}) + r")\b",
    re.I,
)

_ASK_PATTERNS = (
    re.compile(
        r"\bborrow\s+(?:a|an|some)\s+(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"(?:(?:does|do|has|have)\s+)?(?:any(?:one|body))\s+(?:have|has|got)\s+(?:a |an |the |some |any )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"who(?:'s|’s)?\s+(?:has|got|have)\s+(?:a |an |the |some |any )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"(?:can|could|may)\s+i\s+borrow\s+(?:(?P<qty>\d+|"
        + "|".join(_WORD_QTY)
        + r")\s+)?(?:a |an |the |some )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"i\s+need\s+to\s+borrow\s+(?:(?P<qty>\d+|"
        + "|".join(_WORD_QTY)
        + r")\s+)?(?:a |an |the |some )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"borrow\s+request\s+for\s+(?:a |an |the |some |any )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"^borrow\s*:\s*(?:a |an |the |some |any )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"looking\s+for\s+(?:a |an |the |some |any )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"i\s+need\s+(?:(?P<qty>\d+|"
        + "|".join(_WORD_QTY)
        + r")\s+)?(?:a |an |the |some )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"(?:would\s+(?:love|like)|want|wanna)\s+to\s+borrow\s+(?:(?P<qty>\d+|"
        + "|".join(_WORD_QTY)
        + r")\s+)?(?:a |an |the |some )?(?P<item>.+)",
        re.I,
    ),
    re.compile(
        r"\bto\s+borrow\s+(?:(?P<qty>\d+|"
        + "|".join(_WORD_QTY)
        + r")\s+)?(?:a |an |the |some )?(?P<item>.+)",
        re.I,
    ),
)

MATCH_SCORE_THRESHOLD = 0.42
MATCH_LIMIT = 5


@dataclass(frozen=True)
class ClosetAskParse:
    item_query: str
    quantity: int | None
    date_needed_by: date | None
    raw_text: str


def parse_closet_ask(text: str, *, today: date | None = None) -> ClosetAskParse | None:
    raw = (text or "").strip()
    if not raw:
        return None
    today = today or date.today()
    working, needed_by = _extract_need_by(raw, today=today)
    working, qty_from_tail = _extract_trailing_quantity(working)
    working = _TRAILING_HEDGE_RE.sub("", working).strip()
    chosen = _best_ask(working)
    if not chosen:
        return None
    item_query, quantity = chosen
    quantity = quantity or qty_from_tail
    return ClosetAskParse(
        item_query=item_query,
        quantity=quantity,
        date_needed_by=needed_by,
        raw_text=raw,
    )


def tokenize_query(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall((text or "").casefold()) if t not in _STOP and len(t) > 1}


def collapse_alnum(text: str) -> str:
    return _COLLAPSE_RE.sub("", (text or "").casefold())


def score_item_for_query(query: str, *, name: str, description: str = "", tags: list | None = None) -> float:
    q = (query or "").strip()
    n = (name or "").strip()
    if not q or not n:
        return 0.0
    q_cf = q.casefold()
    n_cf = n.casefold()
    if q_cf == n_cf:
        return 1.0
    q_c = collapse_alnum(q)
    n_c = collapse_alnum(n)
    if q_c and n_c and (q_c == n_c or q_c in n_c or n_c in q_c):
        return 0.92
    q_tokens = tokenize_query(q)
    n_tokens = tokenize_query(n)
    if q_tokens and q_tokens <= n_tokens:
        return 0.85
    hay_tokens = n_tokens | tokenize_query(description) | tokenize_query(" ".join(tags or []))
    overlap = (len(q_tokens & n_tokens) / len(q_tokens)) if q_tokens else 0.0
    overlap_hay = (len(q_tokens & hay_tokens) / len(q_tokens)) if q_tokens else 0.0
    ratio = SequenceMatcher(None, q_cf, n_cf).ratio()
    return max(overlap * 0.72, overlap_hay * 0.55, ratio * 0.65)


def score_closet_items_for_query(query: str, items, *, limit: int = MATCH_LIMIT, threshold: float = MATCH_SCORE_THRESHOLD):
    """Return items with score >= threshold, highest first, capped at limit."""
    ranked: list[tuple[float, object]] = []
    for item in items:
        tags = getattr(item, "tags", None) or []
        if not isinstance(tags, list):
            tags = []
        score = score_item_for_query(
            query,
            name=getattr(item, "name", "") or "",
            description=getattr(item, "description", "") or "",
            tags=tags,
        )
        if score >= threshold:
            ranked.append((score, item))
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in ranked[:limit]]


def looks_like_chatter(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return True
    if _CHATTER_RE.match(raw):
        return True
    if _NOT_ASK_RE.search(raw):
        return True
    if not slack_message_tokens(raw):
        return True
    return False


def slack_message_tokens(text: str) -> list[str]:
    seen: list[str] = []
    for token in _TOKEN_RE.findall((text or "").casefold()):
        if token in _SCAN_STOP or len(token) < 2:
            continue
        if token not in seen:
            seen.append(token)
    return seen


def slack_message_terms(text: str) -> list[str]:
    """Unigrams plus adjacent bigrams/trigrams from the Slack message, minus filler."""
    ordered = [t for t in _TOKEN_RE.findall((text or "").casefold()) if t not in _SCAN_STOP and len(t) > 1]
    terms: list[str] = []
    for token in ordered:
        if token not in terms:
            terms.append(token)
    for n in (2, 3):
        for i in range(len(ordered) - n + 1):
            phrase = " ".join(ordered[i : i + n])
            if phrase not in terms:
                terms.append(phrase)
    return terms


def score_item_for_scan_term(term: str, *, name: str, description: str = "", tags: list | None = None) -> float:
    """Score one Slack word/phrase against an item; unigrams cannot weakly hit multi-word names."""
    term = (term or "").strip()
    name = (name or "").strip()
    if not term or not name:
        return 0.0
    base = score_item_for_query(term, name=name, description=description, tags=tags)
    if " " in term:
        return base
    name_tokens = tokenize_query(name)
    collapsed_term = collapse_alnum(term)
    collapsed_name = collapse_alnum(name)
    if len(name_tokens) <= 1:
        # "love" must not hit "glove" via infix/suffix or fuzzy ratio; "glove"
        # may still hit "gloves" as a prefix of the name token.
        if collapsed_term and collapsed_name and collapsed_term == collapsed_name:
            return base
        q_tokens = tokenize_query(term)
        if q_tokens and name_tokens and q_tokens <= name_tokens:
            return base
        if collapsed_term and collapsed_name and collapsed_name.startswith(collapsed_term):
            return base
        return 0.0
    if not collapsed_term or not collapsed_name or collapsed_term not in collapsed_name:
        return 0.0
    frac = len(collapsed_term) / len(collapsed_name)
    if len(collapsed_term) >= _UNIGRAM_MULTIWORD_MIN_LEN or frac >= _UNIGRAM_MULTIWORD_MIN_FRAC:
        return base
    return 0.0


def score_closet_items_for_message(
    text: str,
    items,
    *,
    limit: int = MATCH_LIMIT,
    threshold: float = MATCH_SCORE_THRESHOLD,
):
    """Scan each significant word/n-gram in `text` against closet item names."""
    terms = slack_message_terms(text)
    if not terms:
        return []
    ranked: list[tuple[float, object]] = []
    for item in items:
        tags = getattr(item, "tags", None) or []
        if not isinstance(tags, list):
            tags = []
        name = getattr(item, "name", "") or ""
        description = getattr(item, "description", "") or ""
        best = 0.0
        for term in terms:
            best = max(
                best,
                score_item_for_scan_term(term, name=name, description=description, tags=tags),
            )
        if best >= threshold:
            ranked.append((best, item))
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in ranked[:limit]]


def merge_scored_item_lists(*groups, limit: int = MATCH_LIMIT) -> list:
    """Dedupe items preserving the first-seen order of highest-priority groups."""
    seen: set[int] = set()
    out: list = []
    for group in groups:
        for item in group:
            key = id(item)
            ident = getattr(item, "id", None)
            key = ident if ident is not None else key
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
            if len(out) >= limit:
                return out
    return out


def item_query_from_message_matches(text: str, items) -> str:
    """Best Slack n-gram that hit the top match; fallback to that item's name."""
    if not items:
        return ""
    top = items[0]
    name = getattr(top, "name", "") or ""
    description = getattr(top, "description", "") or ""
    tags = getattr(top, "tags", None) or []
    if not isinstance(tags, list):
        tags = []
    best_term = ""
    best_score = 0.0
    for term in slack_message_terms(text):
        score = score_item_for_scan_term(term, name=name, description=description, tags=tags)
        if score > best_score or (score == best_score and len(term) > len(best_term)):
            best_score = score
            best_term = term
    return (best_term or name).strip()[:255]


def _best_ask(text: str) -> tuple[str, int | None] | None:
    """Return the strongest (item_query, qty) among all ask-pattern hits."""
    best: tuple[str, int | None] | None = None
    for pat in _ASK_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        item_raw = (m.group("item") or "").strip()
        qty_pat = _parse_qty_token(m.group("qty")) if "qty" in m.re.groupindex else None
        item_query, qty_item = _clean_item_phrase(item_raw)
        if not item_query:
            continue
        qty = qty_pat or qty_item
        if best is None or len(item_query) > len(best[0]):
            best = (item_query, qty)
    return best


def _parse_qty_token(raw: str | None) -> int | None:
    if not raw:
        return None
    token = raw.strip().casefold()
    if token.isdigit():
        n = int(token)
        return n if n > 0 else None
    return _WORD_QTY.get(token)


def parse_request_command_text(text: str) -> tuple[str, int | None]:
    """Item name and optional leading quantity from `/request` command text."""
    return _clean_item_phrase(text or "")


def _clean_item_phrase(phrase: str) -> tuple[str, int | None]:
    s = (phrase or "").strip()
    s = s.split("?")[0].split("!")[0]
    s = re.split(r"\s+i\s+need\b", s, maxsplit=1, flags=re.I)[0]
    s = re.split(r"\bneeded\s+by\b", s, maxsplit=1, flags=re.I)[0]
    s = s.strip(" .,;:-")
    qty = None
    leading = re.match(
        r"^(\d+|" + "|".join(_WORD_QTY) + r")\s+(?:of\s+)?(.+)$",
        s,
        re.I,
    )
    if leading:
        qty = _parse_qty_token(leading.group(1))
        s = leading.group(2).strip()
    s = re.sub(r"\s+from\s+(?:somebody|someone|anyone|anybody)\b.*$", "", s, flags=re.I)
    s = _TRAILING_HEDGE_RE.sub("", s)
    s = re.sub(r"\s+if\s+(?:any(?:one|body)|someone|somebody)\b.*$", "", s, flags=re.I)
    s = re.sub(r"\s+(?:if|when|because|but|so|please|pls)\b.*$", "", s, flags=re.I)
    s = re.sub(r"^(?:a|an|the|some|any)\s+", "", s, flags=re.I)
    if s.casefold().startswith("to "):
        return "", qty
    s = re.sub(r"\s+", " ", s).strip(" .,;:-")
    if len(s) < 3:
        return "", qty
    folded = s.casefold()
    if folded in _STOP or folded in _PRONOUN_ITEMS:
        return "", qty
    return s, qty


def _extract_trailing_quantity(text: str) -> tuple[str, int | None]:
    m = _QTY_TRAILING.search(text)
    if m:
        qty = _parse_qty_token(m.group(1))
        stripped = (text[: m.start()] + " " + text[m.end() :]).strip()
        return stripped, qty
    m2 = _QTY_NEED_N.search(text)
    if m2 and not re.search(r"\bi\s+need\s+to\s+borrow\b", text, re.I):
        # Avoid treating "I need to borrow 3 camping chairs" twice; leading qty is in the ask pattern.
        if re.search(r"\b(?:borrow|have)\b", text, re.I) and m2.start() < 12:
            return text, None
        qty = _parse_qty_token(m2.group(1))
        return text, qty
    return text, None


def _extract_need_by(text: str, *, today: date) -> tuple[str, date | None]:
    needed: date | None = None
    working = text

    def _clip(m: re.Match[str], parsed: date | None) -> str:
        nonlocal needed
        if parsed is not None and needed is None:
            needed = parsed
        return (working[: m.start()] + " " + working[m.end() :]).strip()

    m = _DATE_BY_ISO.search(working)
    if m:
        working = _clip(m, _parse_iso(m.group(1)))
    m = _DATE_BY_MDY.search(working)
    if m:
        working = _clip(m, _parse_mdy(m.group(1), today=today))
    m = _DATE_BY_WEEKDAY.search(working)
    if m:
        working = _clip(m, _next_weekday(today, m.group(1).casefold()))
    m = _DATE_BY_TOMORROW.search(working)
    if m:
        working = _clip(m, today + timedelta(days=1))
    m = _DATE_BY_TODAY.search(working)
    if m:
        working = _clip(m, today)
    if needed is not None and needed < today:
        needed = today
    return working, needed


def _parse_iso(raw: str) -> date | None:
    try:
        parts = [int(p) for p in raw.split("-")]
        return date(parts[0], parts[1], parts[2])
    except (ValueError, IndexError):
        return None


def _parse_mdy(raw: str, *, today: date) -> date | None:
    bits = raw.split("/")
    try:
        month = int(bits[0])
        day = int(bits[1])
        if len(bits) == 3:
            year = int(bits[2])
            if year < 100:
                year += 2000
        else:
            year = today.year
        parsed = date(year, month, day)
        if len(bits) == 2 and parsed < today:
            parsed = date(year + 1, month, day)
        return parsed
    except ValueError:
        return None


def _next_weekday(today: date, name: str) -> date:
    target = _WEEKDAYS.index(name)
    delta = (target - today.weekday()) % 7
    return today + timedelta(days=delta)
