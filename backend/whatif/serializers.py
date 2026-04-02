from rest_framework import serializers

from whatif import rules
from whatif.models import WhatIfPlayer, WhatIfQuestion, WhatIfSession


class SessionCreateSerializer(serializers.Serializer):
    pass


class JoinSessionSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=80)

    def validate_display_name(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Display name is required.")
        return trimmed


class SessionActionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[
            "start_game",
            "toggle_ready",
            "pick_subject",
            "vote",
            "reveal",
            "next_turn",
            "skip",
            "set_player_paused",
        ]
    )
    option_index = serializers.IntegerField(required=False)
    target_player_id = serializers.IntegerField(required=False)
    paused = serializers.BooleanField(required=False)


class WhatIfPlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatIfPlayer
        fields = [
            "id",
            "display_name",
            "avatar_emoji",
            "score",
            "skips_remaining",
            "ready_to_start",
            "paused",
        ]


class WhatIfQuestionPublicSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()

    class Meta:
        model = WhatIfQuestion
        fields = ["id", "prompt", "answers"]

    def get_answers(self, obj: WhatIfQuestion) -> dict[str, str]:
        return {str(k): v for k, v in obj.answers_map().items()}


class WhatIfQuestionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatIfQuestion
        fields = [
            "id",
            "prompt",
            "answer_1",
            "answer_2",
            "answer_3",
            "answer_4",
            "answer_5",
            "answer_6",
            "is_active",
            "sessions_used_count",
            "total_responses",
            "total_scores",
            "total_skips",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "sessions_used_count",
            "total_responses",
            "total_scores",
            "total_skips",
            "created_at",
            "updated_at",
        ]


class WhatIfSessionPublicSerializer(serializers.ModelSerializer):
    players = WhatIfPlayerSerializer(many=True, read_only=True)
    win_score = serializers.SerializerMethodField()

    class Meta:
        model = WhatIfSession
        fields = [
            "short_code",
            "status",
            "challenge_mode",
            "state_version",
            "state",
            "players",
            "win_score",
            "created_at",
            "updated_at",
        ]

    def get_win_score(self, _obj: WhatIfSession) -> int:
        return rules.WIN_SCORE

