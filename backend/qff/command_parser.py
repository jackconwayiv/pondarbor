"""Parse player command lines into structured actions."""

from __future__ import annotations

import re
from dataclasses import dataclass
from qff.models import RoomExit


@dataclass
class ParsedMove:
    direction: str  # RoomExit.Direction value


@dataclass
class ParsedSearch:
    pass


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
    """Return ParsedMove, ParsedSearch, or ParsedUnknown."""
    raw = line
    n = _normalize(line)
    if not n:
        return ParsedUnknown(raw=raw)

    low = n.lower()

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
