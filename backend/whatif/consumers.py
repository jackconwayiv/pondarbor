"""WhatIf WebSocket: per-session sync and voting deadline checks."""

from __future__ import annotations

import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
from django.shortcuts import get_object_or_404

from whatif.models import WhatIfPlayer, WhatIfSession
from whatif.realtime import whatif_session_group_name
from whatif.gameplay import maybe_declare_pending_winner
from whatif.views import _load_session, _maybe_auto_reveal_voting

WS_PING_THROTTLE_SECONDS = 2


def _ping_throttled(code: str) -> bool:
    key = f"whatif:ws_ping:{code.upper()}"
    if cache.get(key):
        return True
    cache.set(key, 1, timeout=WS_PING_THROTTLE_SECONDS)
    return False


def _validate_player_token(code: str, token: str) -> bool:
    session = get_object_or_404(WhatIfSession, short_code=code.upper())
    return WhatIfPlayer.objects.filter(session_id=session.id, player_secret=token).exists()


def _handle_ping(code: str) -> int | None:
    """Run auto-reveal if due; return state_version when session changed, else None."""
    if _ping_throttled(code):
        return None
    session = _load_session(code)
    before_version = session.state_version
    before_status = session.status
    session = _maybe_auto_reveal_voting(session)
    session = maybe_declare_pending_winner(session)
    session.refresh_from_db()
    if session.state_version != before_version or session.status != before_status:
        return session.state_version
    return None


class WhatIfSessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        code = str(self.scope.get("url_route", {}).get("kwargs", {}).get("code") or "").strip().upper()
        if len(code) != 4:
            await self.close(code=4000)
            return

        query = self.scope.get("query_string") or b""
        params = parse_qs(query.decode())
        player_token = (params.get("player_token") or [None])[0]
        if player_token:
            allowed = await database_sync_to_async(_validate_player_token)(code, player_token)
            if not allowed:
                await self.close(code=4003)
                return

        try:
            session = await database_sync_to_async(_load_session)(code)
        except Exception:
            await self.close(code=4004)
            return

        self._code = code
        self._group_name = whatif_session_group_name(code)
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()
        await self.send(
            text_data=json.dumps(
                {"type": "connected", "state_version": session.state_version},
            ),
        )

    async def disconnect(self, close_code):
        del close_code
        if getattr(self, "_group_name", None):
            await self.channel_layer.group_discard(self._group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if data.get("type") != "ping":
            return
        code = getattr(self, "_code", None)
        if not code:
            return
        await database_sync_to_async(_handle_ping)(code)

    async def session_update(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "session_update",
                    "state_version": event.get("state_version"),
                },
            ),
        )
