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
    quantity: int | None = None


@dataclass
class ParsedPut:
    """put / place — deposit an inventory item into the opened container."""

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
class ParsedLookDirection:
    """look east / look e — resolved to an exit when passable and visible (see handler)."""

    direction: str  # RoomExit.Direction value
    original_token: str
    verb: str = "look"  # "look" | "inspect"


@dataclass
class ParsedRead:
    target: str


@dataclass
class ParsedTalk:
    target: str


@dataclass
class ParsedOpenContainer:
    """open / open <name> — interactables only (containers, maps, etc.)."""

    target: str


@dataclass
class ParsedUse:
    verb: str  # use | pull | push
    target: str


@dataclass
class ParsedShopBrowse:
    """shop / list / bare buy|purchase — optional npc_query for disambiguation."""

    npc_query: str = ""


@dataclass
class ParsedShopBuy:
    """buy|purchase <item> or buy <item> from <npc>."""

    item_query: str = ""
    npc_query: str = ""


@dataclass
class ParsedAttack:
    target: str


@dataclass
class ParsedTrain:
    pass


@dataclass
class ParsedBuyAbilities:
    """Placeholder until spell / ability shop ships."""

    pass


@dataclass
class ParsedSell:
    """sell <item> or sell <item> to <npc>."""

    item_query: str = ""
    npc_query: str = ""
    sell_all: bool = False


@dataclass
class ParsedRestSleep:
    """rest / sleep / nap — triggers the current room's innkeeper (preferred) or healer."""

    pass


@dataclass
class ParsedLeave:
    """leave / exit / quit — queue a return to the lobby (delayed in unsafe rooms)."""

    pass


@dataclass
class ParsedEmote:
    """Generic social emote (wave, etc.). ``target`` is a player name or empty."""

    verb: str
    target: str = ""


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
    # Many MUD clients send a prompt prefix like "> look" or ">> north".
    line = line.lstrip(">").strip()
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
]

# Bare "leave"/"exit"/"quit" now mean "return to lobby"; use "out" for the OUT exit.
_LEAVE_WORDS = {"leave", "exit", "quit"}

# Single-word emote verbs; extend as we add more (bow, smile, etc.).
_EMOTE_VERBS: set[str] = {"wave"}

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


def _parsed_get_from_rest(rest: str) -> ParsedGet:
    """Parse get/take/pick up remainder; optional leading ``N `` for quantity (e.g. ``3 gold``)."""
    rest = (rest or "").strip()
    if not rest:
        return ParsedGet(target="")
    m = re.fullmatch(r"(\d+)\s+(.+)", rest)
    if m:
        q = int(m.group(1))
        if q >= 1:
            return ParsedGet(target=m.group(2).strip(), quantity=q)
    return ParsedGet(target=rest, quantity=None)


def _direction_for_look_remainder(remainder: str) -> tuple[str, str] | None:
    """If ``remainder`` is a single direction token, return (RoomExit.Direction, token)."""
    parts = remainder.strip().split()
    if len(parts) != 1:
        return None
    tok = parts[0].lower()
    if tok in _SINGLE_LETTER:
        return (_SINGLE_LETTER[tok], tok)
    if tok in _TWO_LETTER:
        return (_TWO_LETTER[tok], tok)
    if tok in ("in",):
        return (RoomExit.Direction.IN, tok)
    if tok in ("out",):
        return (RoomExit.Direction.OUT, tok)
    for word, direction in _DIRECTION_SYNONYMS:
        if tok == word:
            return (direction, tok)
    return None


def parse_command(line: str):
    """Return structured parse result for movement, search, social, items, or unknown."""
    raw = line
    n = _normalize(line)
    if not n:
        return ParsedUnknown(raw=raw)

    low = n.lower()

    # leave / exit / quit — return to lobby (queued in unsafe rooms)
    if low in _LEAVE_WORDS:
        return ParsedLeave()

    # Emotes (wave, ...): "wave", "wave <name>", "wave at <name>"
    first, _, remainder = low.partition(" ")
    if first in _EMOTE_VERBS:
        remainder_raw = n[len(first):].strip()
        if remainder_raw.lower().startswith("at "):
            remainder_raw = remainder_raw[3:].strip()
        return ParsedEmote(verb=first, target=remainder_raw)

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
    if low.startswith("speak with "):
        return ParsedTalk(target=n[11:].strip())
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
        return ParsedOpenContainer(target=n[5:].strip())
    if low == "open":
        return ParsedOpenContainer(target="")

    # look / inspect
    if low.startswith("look at "):
        return ParsedLookInspect(verb="look", target=n[8:].strip())
    if low.startswith("look "):
        rem = n[5:].strip()
        if rem:
            dr = _direction_for_look_remainder(rem)
            if dr:
                return ParsedLookDirection(
                    direction=dr[0], original_token=dr[1], verb="look"
                )
        return ParsedLookInspect(verb="look", target=rem)
    if low == "look":
        return ParsedLookInspect(verb="look", target="")
    if low.startswith("inspect "):
        rem = n[8:].strip()
        if rem:
            dr = _direction_for_look_remainder(rem)
            if dr:
                return ParsedLookDirection(
                    direction=dr[0], original_token=dr[1], verb="inspect"
                )
        return ParsedLookInspect(verb="inspect", target=rem)
    if low == "inspect":
        return ParsedLookInspect(verb="inspect", target="")

    # read (signs, tomes)
    if low.startswith("read "):
        return ParsedRead(target=n[5:].strip())
    if low == "read":
        return ParsedRead(target="")

    # rest / sleep / nap — service NPC (innkeeper preferred, healer fallback)
    if low in ("rest", "sleep", "nap"):
        return ParsedRestSleep()

    # shop / list / buy / purchase / sell
    if low in ("shop", "list"):
        return ParsedShopBrowse()
    if low.startswith("shop "):
        return ParsedShopBrowse(npc_query=n[5:].strip())
    if low.startswith("list "):
        return ParsedShopBrowse(npc_query=n[5:].strip())
    if low in ("buy", "purchase"):
        return ParsedShopBrowse()
    if low in ("buy abilities", "purchase abilities"):
        return ParsedBuyAbilities()
    if low.startswith("buy "):
        rest = n[4:].strip()
        m = re.match(r"(?is)^(.+?)\s+from\s+(.+)$", rest)
        if m:
            return ParsedShopBuy(
                item_query=m.group(1).strip(),
                npc_query=m.group(2).strip(),
            )
        return ParsedShopBuy(item_query=rest, npc_query="")
    if low.startswith("purchase "):
        rest = n[9:].strip()
        m = re.match(r"(?is)^(.+?)\s+from\s+(.+)$", rest)
        if m:
            return ParsedShopBuy(
                item_query=m.group(1).strip(),
                npc_query=m.group(2).strip(),
            )
        return ParsedShopBuy(item_query=rest, npc_query="")
    if low.startswith("attack "):
        return ParsedAttack(target=n[7:].strip())
    if low in ("attack", "atk"):
        return ParsedAttack(target="")
    if low.startswith("atk "):
        return ParsedAttack(target=n[4:].strip())
    if low in ("train",):
        return ParsedTrain()
    if low == "sell":
        return ParsedSell()
    if low.startswith("sell all "):
        rest = n[9:].strip()
        m = re.match(r"(?is)^(.+?)\s+to\s+(.+)$", rest)
        if m:
            return ParsedSell(
                item_query=m.group(1).strip(),
                npc_query=m.group(2).strip(),
                sell_all=True,
            )
        return ParsedSell(item_query=rest, npc_query="", sell_all=True)
    if low.startswith("sell "):
        rest = n[5:].strip()
        m = re.match(r"(?is)^(.+?)\s+to\s+(.+)$", rest)
        if m:
            return ParsedSell(
                item_query=m.group(1).strip(),
                npc_query=m.group(2).strip(),
                sell_all=False,
            )
        return ParsedSell(item_query=rest, npc_query="", sell_all=False)

    # unequip
    if low.startswith("unequip "):
        return ParsedUnequip(target=n[8:].strip())
    if low == "unequip":
        return ParsedUnequip(target="")
    if low.startswith("remove "):
        return ParsedUnequip(target=n[7:].strip())
    if low == "remove":
        return ParsedUnequip(target="")
    if low.startswith("take off "):
        return ParsedUnequip(target=n[9:].strip())
    if low == "take off":
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
    if low.startswith("pick up "):
        return _parsed_get_from_rest(n[8:])
    if low == "pick up":
        return ParsedGet(target="")
    if low.startswith("get "):
        return _parsed_get_from_rest(n[4:])
    if low == "get":
        return ParsedGet(target="")
    if low.startswith("grab "):
        return _parsed_get_from_rest(n[5:])
    if low == "grab":
        return ParsedGet(target="")
    if low.startswith("take "):
        return _parsed_get_from_rest(n[5:])
    if low == "take":
        return ParsedGet(target="")
    if low.startswith("equip "):
        return ParsedEquip(target=n[6:].strip())
    if low == "equip":
        return ParsedEquip(target="")
    if low.startswith("wear "):
        return ParsedEquip(target=n[5:].strip())
    if low == "wear":
        return ParsedEquip(target="")
    if low.startswith("put on "):
        return ParsedEquip(target=n[7:].strip())
    if low == "put on":
        return ParsedEquip(target="")
    if low.startswith("put "):
        return ParsedPut(target=n[4:].strip())
    if low == "put":
        return ParsedPut(target="")
    if low.startswith("place "):
        return ParsedPut(target=n[6:].strip())
    if low == "place":
        return ParsedPut(target="")

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
