"""Parse player command lines into structured actions."""

from __future__ import annotations

import re
from dataclasses import dataclass

from qff.constants import SAY_MAX_LEN
from qff.models import RoomExit


@dataclass
class ParsedMove:
    direction: str  # RoomExit.Direction value


@dataclass
class ParsedSearch:
    pass


@dataclass
class ParsedSay:
    text: str


@dataclass
class ParsedDrop:
    target: str
    # If set, drop only this many from a stack (inventory only); None = entire instance.
    quantity: int | None = None


@dataclass
class ParsedGet:
    target: str


@dataclass
class ParsedConsumeItem:
    """Eat / drink / use-on-item (inventory consumable)."""

    verb: str  # eat | drink | use
    target: str


@dataclass
class ParsedEquip:
    target: str


@dataclass
class ParsedUnequip:
    target: str


@dataclass
class ParsedLookInspect:
    verb: str  # "look" | "inspect"
    target: str


@dataclass
class ParsedTalk:
    target: str


@dataclass
class ParsedUse:
    verb: str  # use | pull | push | open
    target: str


@dataclass
class ParsedUnknown:
    raw: str


def _strip_go_prefix(s: str) -> str:
    s = s.strip()
    if s.lower().startswith("go "):
        return s[3:].strip()
    return s


def _normalize(line: str) -> str:
    line = line.strip()
    if line.startswith("/"):
        line = line[1:].strip()
    line = _strip_go_prefix(line)
    return line.strip()


def _strip_say_quotes(text: str) -> str:
    t = text.strip()
    if len(t) >= 2 and t[0] == t[-1] and t[0] in '"\'':
        return t[1:-1].strip()
    return t


# Longest-first synonym matching (multi-word before single-token).
_DIRECTION_SYNONYMS: list[tuple[str, str]] = [
    ("northwest", RoomExit.Direction.NW),
    ("southwest", RoomExit.Direction.SW),
    ("northeast", RoomExit.Direction.NE),
    ("southeast", RoomExit.Direction.SE),
    ("north", RoomExit.Direction.N),
    ("south", RoomExit.Direction.S),
    ("east", RoomExit.Direction.E),
    ("west", RoomExit.Direction.W),
    ("down", RoomExit.Direction.DOWN),
    ("up", RoomExit.Direction.UP),
    ("enter", RoomExit.Direction.IN),
    ("leave", RoomExit.Direction.OUT),
    ("exit", RoomExit.Direction.OUT),
]

_SINGLE_LETTER = {
    "n": RoomExit.Direction.N,
    "s": RoomExit.Direction.S,
    "e": RoomExit.Direction.E,
    "w": RoomExit.Direction.W,
    "u": RoomExit.Direction.UP,
    "d": RoomExit.Direction.DOWN,
}

_TWO_LETTER = {
    "nw": RoomExit.Direction.NW,
    "ne": RoomExit.Direction.NE,
    "sw": RoomExit.Direction.SW,
    "se": RoomExit.Direction.SE,
}


def parse_command(line: str):
    """Return structured parse result for movement, search, social, items, or unknown."""
    raw = line
    n = _normalize(line)
    if not n:
        return ParsedUnknown(raw=raw)

    low = n.lower()

    # say / say …
    if low == "say":
        return ParsedSay(text="")
    if low.startswith("say "):
        text = _strip_say_quotes(n[4:].strip())
        return ParsedSay(text=text[:SAY_MAX_LEN])

    # talk / speak / greet
    if low.startswith("talk to "):
        return ParsedTalk(target=n[8:].strip())
    if low.startswith("talk "):
        return ParsedTalk(target=n[5:].strip())
    if low == "talk":
        return ParsedTalk(target="")
    if low.startswith("speak to "):
        return ParsedTalk(target=n[9:].strip())
    if low.startswith("speak "):
        return ParsedTalk(target=n[6:].strip())
    if low.startswith("greet "):
        return ParsedTalk(target=n[6:].strip())

    # eat / drink (before generic "use")
    if low.startswith("eat "):
        return ParsedConsumeItem(verb="eat", target=n[4:].strip())
    if low == "eat":
        return ParsedConsumeItem(verb="eat", target="")
    if low.startswith("drink "):
        return ParsedConsumeItem(verb="drink", target=n[6:].strip())
    if low == "drink":
        return ParsedConsumeItem(verb="drink", target="")

    # use / pull / push / open
    if low.startswith("use "):
        return ParsedUse(verb="use", target=n[4:].strip())
    if low.startswith("pull "):
        return ParsedUse(verb="pull", target=n[5:].strip())
    if low.startswith("push "):
        return ParsedUse(verb="push", target=n[5:].strip())
    if low.startswith("open "):
        return ParsedUse(verb="open", target=n[5:].strip())

    # look / inspect
    if low.startswith("look at "):
        return ParsedLookInspect(verb="look", target=n[8:].strip())
    if low.startswith("look "):
        return ParsedLookInspect(verb="look", target=n[5:].strip())
    if low == "look":
        return ParsedLookInspect(verb="look", target="")
    if low.startswith("inspect "):
        return ParsedLookInspect(verb="inspect", target=n[8:].strip())
    if low == "inspect":
        return ParsedLookInspect(verb="inspect", target="")

    # unequip
    if low.startswith("unequip "):
        return ParsedUnequip(target=n[8:].strip())
    if low == "unequip":
        return ParsedUnequip(target="")

    # drop / get / equip
    if low.startswith("drop "):
        rest = n[5:].strip()
        qty: int | None = None
        target = rest
        m = re.fullmatch(r"(\d+)\s+(.+)", rest)
        if m:
            q = int(m.group(1))
            if q >= 1:
                qty = q
                target = m.group(2).strip()
        return ParsedDrop(target=target, quantity=qty)
    if low == "drop":
        return ParsedDrop(target="")
    if low.startswith("get "):
        return ParsedGet(target=n[4:].strip())
    if low == "get":
        return ParsedGet(target="")
    if low.startswith("take "):
        return ParsedGet(target=n[5:].strip())
    if low == "take":
        return ParsedGet(target="")
    if low.startswith("equip "):
        return ParsedEquip(target=n[6:].strip())
    if low == "equip":
        return ParsedEquip(target="")

    # Search
    if low in ("search", "search room", "scr"):
        return ParsedSearch()
    if re.fullmatch(r"search\s+room", low):
        return ParsedSearch()

    # Multi-word directions (full words)
    for word, direction in _DIRECTION_SYNONYMS:
        if low == word or low == f"go {word}":
            return ParsedMove(direction=direction)

    # Single token
    parts = low.split()
    if len(parts) == 1:
        tok = parts[0]
        if tok in _SINGLE_LETTER:
            return ParsedMove(direction=_SINGLE_LETTER[tok])
        if tok in _TWO_LETTER:
            return ParsedMove(direction=_TWO_LETTER[tok])
        if tok in ("in",):
            return ParsedMove(direction=RoomExit.Direction.IN)
        if tok in ("out",):
            return ParsedMove(direction=RoomExit.Direction.OUT)

    # "go north" style already handled for full words; handle "go n"
    if len(parts) == 2 and parts[0] == "go":
        rest = parts[1]
        if rest in _SINGLE_LETTER:
            return ParsedMove(direction=_SINGLE_LETTER[rest])
        if rest in _TWO_LETTER:
            return ParsedMove(direction=_TWO_LETTER[rest])
        for word, direction in _DIRECTION_SYNONYMS:
            if rest == word:
                return ParsedMove(direction=direction)

    return ParsedUnknown(raw=raw)
