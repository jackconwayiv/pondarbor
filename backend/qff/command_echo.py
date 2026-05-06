"""Whether the play client should echo the user's raw command line with server messages."""

from __future__ import annotations

from qff.command_parser import ParsedUnknown

# First-line messages that mean the command did not succeed as a normal action.
_ECHO_FIRST_MESSAGES = frozenset(
    {
        "Attack what?",
        "You don't see that here.",
        "There is no trainer here.",
        "Sell what?",
        "You don't have that.",
        "Unequip that first.",
        "Nobody here is selling ability scrolls yet. "
        "(Magic combat is still a stub — see qff.magic_combat.)",
        "Type a command.",
    }
)


def should_echo_command(parsed, messages: list[str]) -> bool:
    if isinstance(parsed, ParsedUnknown):
        return True
    if not messages:
        return False
    first = messages[0]
    if first == "You are dead and cannot act.":
        return True
    if first == "Staff only.":
        return True
    if first in _ECHO_FIRST_MESSAGES:
        return True
    if first.startswith("You need at least"):
        return True
    if first.startswith("You're ") and "XP shy of Level" in first:
        return True
    if first.startswith("You try that, but nothing happens."):
        return True
    return False
