from __future__ import annotations

import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.shortcuts import get_object_or_404
from rest_framework import exceptions

from users.auth0_backend import authenticate_bearer_token
from users.models import User

from .models import EstatesGame
from .presence import adjust_presence_connection
from .realtime import ESTATES_LOBBIES_GROUP, estates_game_group_name


def _authenticate_ws_token(token: str):
    return authenticate_bearer_token(token)


def _user_can_access_game(*, user_id: int, game_id: str) -> bool:
    game = get_object_or_404(EstatesGame, pk=game_id)
    return game.player_1_id == user_id or game.player_2_id == user_id


def _seat_for_user_id(*, game_id: str, user_id: int) -> int | None:
    game = EstatesGame.objects.get(pk=game_id)
    if game.player_1_id == user_id:
        return 1
    if game.player_2_id == user_id:
        return 2
    return None


class EstatesGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        game_id = str(self.scope.get("url_route", {}).get("kwargs", {}).get("game_id") or "").strip()
        if not game_id:
            await self.close(code=4000)
            return
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

        allowed = await database_sync_to_async(_user_can_access_game)(user_id=user.id, game_id=game_id)
        if not allowed:
            await self.close(code=4003)
            return

        seat_index = await database_sync_to_async(_seat_for_user_id)(game_id=game_id, user_id=user.id)
        if seat_index is None:
            await self.close(code=4003)
            return

        self._game_id = game_id
        self._seat_index = seat_index
        self._group_name = estates_game_group_name(game_id)
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()
        await database_sync_to_async(adjust_presence_connection)(
            game_id=game_id,
            seat_index=seat_index,
            delta=1,
        )
        await self.send(text_data=json.dumps({"type": "connected", "game_id": game_id}))

    async def disconnect(self, close_code):
        del close_code
        if getattr(self, "_group_name", None):
            await self.channel_layer.group_discard(self._group_name, self.channel_name)
        game_id = getattr(self, "_game_id", None)
        seat_index = getattr(self, "_seat_index", None)
        if game_id and seat_index:
            await database_sync_to_async(adjust_presence_connection)(
                game_id=game_id,
                seat_index=seat_index,
                delta=-1,
            )

    async def receive(self, text_data):
        del text_data

    async def game_update(self, event):
        del event
        await self.send(text_data=json.dumps({"type": "game_update"}))


class EstatesLobbiesConsumer(AsyncWebsocketConsumer):
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

        self._group_name = ESTATES_LOBBIES_GROUP
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({"type": "connected"}))

    async def disconnect(self, close_code):
        del close_code
        if getattr(self, "_group_name", None):
            await self.channel_layer.group_discard(self._group_name, self.channel_name)

    async def receive(self, text_data):
        del text_data

    async def lobbies_update(self, event):
        del event
        await self.send(text_data=json.dumps({"type": "lobbies_update"}))
