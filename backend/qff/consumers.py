"""QFF WebSocket: session sync and room broadcasts."""

from __future__ import annotations

import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework import exceptions

from users.auth0_backend import authenticate_bearer_token
from users.models import User

from qff.monster_sim import run_lazy_simulation
from qff.realtime import async_notify_qff_rooms
from qff.session_payload import active_heroes_in_realm, build_session_for_character
from qff.views import _get_character, _touch_session_activity_for_user


def _authenticate_ws_token(token: str):
    return authenticate_bearer_token(token)


class QffSessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query = self.scope.get("query_string") or b""
        params = parse_qs(query.decode())
        token = (params.get("token") or [None])[0]
        if not token:
            await self.close(code=4001)
            return

        try:
            user, _ = await sync_to_async(_authenticate_ws_token, thread_sensitive=False)(token)
        except exceptions.AuthenticationFailed:
            await self.close(code=4001)
            return

        if user.account_status != User.AccountStatus.APPROVED:
            await self.close(code=4003)
            return

        self.user = user
        char = await database_sync_to_async(_get_character)(user)
        if not char:
            await self.close(code=4004)
            return

        self._room_id = char.current_room_id
        self._room_group_name = f"qff_room_{self._room_id}"
        await self.channel_layer.group_add(self._room_group_name, self.channel_name)
        await self.accept()

        await async_notify_qff_rooms([char.current_room_id])

        session = await database_sync_to_async(build_session_for_character)(char)
        await self.send(
            text_data=json.dumps({"type": "session", "session": session}),
        )

    async def disconnect(self, close_code):
        if getattr(self, "_room_group_name", None):
            await self.channel_layer.group_discard(self._room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        msg_type = data.get("type")
        if msg_type == "ping":
            char = await database_sync_to_async(_touch_session_activity_for_user)(self.user)
            if not char:
                return
            await database_sync_to_async(run_lazy_simulation)()
            char = await database_sync_to_async(_get_character)(self.user)
            if not char:
                return
            await async_notify_qff_rooms([char.current_room_id])
            return
        if msg_type == "activity":
            char = await database_sync_to_async(_touch_session_activity_for_user)(self.user)
            await self.send(
                text_data=json.dumps(
                    {"type": "activity_ack", "ok": bool(char)},
                ),
            )
            return
        if msg_type == "who":
            request_id = data.get("request_id")
            rows = await database_sync_to_async(active_heroes_in_realm)()
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "active_heroes",
                        "request_id": request_id,
                        "rows": rows,
                    }
                ),
            )
            return

    async def room_update(self, event):
        del event  # event payload unused
        char = await database_sync_to_async(_get_character)(self.user)
        if not char:
            return
        room_id = char.current_room_id
        if getattr(self, "_room_id", None) != room_id:
            if getattr(self, "_room_group_name", None):
                await self.channel_layer.group_discard(self._room_group_name, self.channel_name)
            self._room_id = room_id
            self._room_group_name = f"qff_room_{room_id}"
            await self.channel_layer.group_add(self._room_group_name, self.channel_name)
        session = await database_sync_to_async(build_session_for_character)(char)
        await self.send(
            text_data=json.dumps({"type": "session", "session": session}),
        )
