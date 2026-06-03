from __future__ import annotations

from rest_framework import serializers

from scorenado.models import MAX_PLAYERS_PER_GAME

MAX_TEMPLATE_ROUNDS = 99


class TemplateCategoryInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    sort_order = serializers.IntegerField(required=False, default=0)
    is_scored = serializers.BooleanField(required=False, default=True)


class TemplateCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    scored_by_rounds = serializers.BooleanField(required=False, default=False)
    low_score_wins = serializers.BooleanField(required=False, default=False)
    min_players = serializers.IntegerField(required=False, min_value=1, max_value=MAX_PLAYERS_PER_GAME)
    default_round_count = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=MAX_TEMPLATE_ROUNDS,
    )
    is_published = serializers.BooleanField(required=False, default=False)
    categories = TemplateCategoryInputSerializer(many=True, required=False)


class TemplatePatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    scored_by_rounds = serializers.BooleanField(required=False)
    low_score_wins = serializers.BooleanField(required=False)
    min_players = serializers.IntegerField(required=False, min_value=1, max_value=MAX_PLAYERS_PER_GAME)
    default_round_count = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=MAX_TEMPLATE_ROUNDS,
    )
    is_published = serializers.BooleanField(required=False)
    categories = TemplateCategoryInputSerializer(many=True, required=False)


class SeatInviteSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class GameTagCreateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=64)
    player_id = serializers.UUIDField(required=False, allow_null=True)


class GamePlayerInputSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255)
    color = serializers.CharField(max_length=32, required=False, default="gray.200")
    sort_order = serializers.IntegerField(required=False)
    team = serializers.CharField(max_length=8, required=False, allow_blank=True, default="")


class GameCreateSerializer(serializers.Serializer):
    template_id = serializers.UUIDField()
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    played_at = serializers.DateField(required=False, allow_null=True)
    players = GamePlayerInputSerializer(many=True, required=False)
    round_count = serializers.IntegerField(required=False, min_value=1, max_value=99)


class GamePatchSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    played_at = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    round_count = serializers.IntegerField(required=False, min_value=1, max_value=99)


class GamePlayerCreateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255)
    color = serializers.CharField(max_length=32, required=False, default="gray.200")
    sort_order = serializers.IntegerField(required=False)
    team = serializers.CharField(max_length=8, required=False, allow_blank=True, default="")


class GamePlayerPatchSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255, required=False)
    color = serializers.CharField(max_length=32, required=False)
    sort_order = serializers.IntegerField(required=False)
    team = serializers.CharField(max_length=8, required=False, allow_blank=True)


class ScoreUpsertSerializer(serializers.Serializer):
    category_id = serializers.UUIDField()
    player_id = serializers.UUIDField()
    value = serializers.IntegerField(required=False, allow_null=True)
    round_number = serializers.IntegerField(required=False, min_value=1, max_value=99)
