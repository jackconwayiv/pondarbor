"""Prefetch helpers for WhatIf session reads (avoid N+1 and duplicate loads)."""

from __future__ import annotations

from django.db.models import Prefetch
from django.shortcuts import get_object_or_404

from whatif.models import WhatIfNpc, WhatIfPlayer, WhatIfSession

_PLAYER_PREFETCH = Prefetch(
    "players",
    queryset=WhatIfPlayer.objects.order_by("created_at", "id"),
)

_NPC_PREFETCH = Prefetch(
    "npcs",
    queryset=WhatIfNpc.objects.order_by("created_at", "id"),
)


def session_read_qs():
    return WhatIfSession.objects.prefetch_related(_PLAYER_PREFETCH, _NPC_PREFETCH)


def session_locked_qs():
    return session_read_qs().select_for_update()


def load_session_read(code: str) -> WhatIfSession:
    return get_object_or_404(session_read_qs(), short_code=code.upper())


def load_session_locked(code: str) -> WhatIfSession:
    return get_object_or_404(session_locked_qs(), short_code=code.upper())


def reload_session_with_prefetch(session_id: int) -> WhatIfSession:
    return get_object_or_404(session_read_qs(), id=session_id)


def _relation_cached(session: WhatIfSession, name: str) -> bool:
    return name in getattr(session, "_prefetched_objects_cache", {})


def players_ordered(session: WhatIfSession) -> list[WhatIfPlayer]:
    if _relation_cached(session, "players"):
        return list(session.players.all())
    return list(session.players.order_by("created_at", "id"))


def npcs_ordered(session: WhatIfSession) -> list[WhatIfNpc]:
    if _relation_cached(session, "npcs"):
        return list(session.npcs.all())
    return list(session.npcs.order_by("created_at", "id"))


def find_player_by_token(session: WhatIfSession, token: str) -> WhatIfPlayer | None:
    token = (token or "").strip()
    if not token:
        return None
    for player in players_ordered(session):
        if str(player.player_secret) == token:
            return player
    return None


def find_player_by_id(session: WhatIfSession, player_id: int) -> WhatIfPlayer | None:
    pid = int(player_id)
    for player in players_ordered(session):
        if player.id == pid:
            return player
    return None


def find_npc_by_id(session: WhatIfSession, npc_id: int) -> WhatIfNpc | None:
    nid = int(npc_id)
    for npc in npcs_ordered(session):
        if npc.id == nid:
            return npc
    return None


def display_name_taken(session: WhatIfSession, display_name: str) -> bool:
    name = display_name.casefold()
    for player in players_ordered(session):
        if player.display_name.casefold() == name:
            return True
    for npc in npcs_ordered(session):
        if npc.display_name.casefold() == name:
            return True
    return False


def user_seat_taken(session: WhatIfSession, user_id: int) -> bool:
    uid = int(user_id)
    for player in players_ordered(session):
        if player.user_id == uid:
            return True
    return False


def entity_count(session: WhatIfSession) -> int:
    return len(players_ordered(session)) + len(npcs_ordered(session))
