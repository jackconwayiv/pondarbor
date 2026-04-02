from rest_framework import serializers

from whatif import rules
from whatif.models import WhatIfPlayer, WhatIfQuestion, WhatIfSession
from whatif.validators import validate_display_name, validate_question_text_field


class SessionCreateSerializer(serializers.Serializer):
    pass


class JoinSessionSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=12)

    def validate_display_name(self, value: str) -> str:
        try:
            return validate_display_name(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class SessionActionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[
            "start_game",
            "toggle_ready",
            "pick_subject",
            "pick_duel_opponent",
            "vote",
            "reveal",
            "next_turn",
            "skip",
            "request_question_skip",
            "resolve_question_skip",
            "set_player_paused",
        ]
    )
    option_index = serializers.IntegerField(required=False)
    target_player_id = serializers.IntegerField(required=False)
    paused = serializers.BooleanField(required=False)
    challenge = serializers.BooleanField(required=False)
    approve = serializers.BooleanField(required=False)


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
    proposed_by = serializers.SerializerMethodField()

    class Meta:
        model = WhatIfQuestion
        fields = ["id", "prompt", "answers", "proposed_by"]

    def get_answers(self, obj: WhatIfQuestion) -> dict[str, str]:
        return {str(k): v for k, v in obj.answers_map().items()}

    def get_proposed_by(self, obj: WhatIfQuestion) -> dict | None:
        if not obj.proposed_by_id:
            return None
        from users.models import Profile

        prof = Profile.objects.filter(user_id=obj.proposed_by_id).first()
        if prof is None:
            return {"display_name": "", "avatar_url": ""}
        return {
            "display_name": (prof.display_name or "").strip(),
            "avatar_url": (prof.avatar_url or "").strip(),
        }


PROMPT_MAX = 2000
ANSWER_MAX = 255


def _validate_question_payload(data: dict, *, partial: bool) -> dict:
    """Shared validation for admin create/patch and player propose."""
    out = dict(data)
    for key in ("prompt", "answer_1", "answer_2", "answer_3", "answer_4", "answer_5", "answer_6"):
        if key not in out and partial:
            continue
        raw = out.get(key, "")
        if key == "prompt":
            out[key] = validate_question_text_field("prompt", str(raw), max_length=PROMPT_MAX)
        else:
            out[key] = validate_question_text_field(key, str(raw), max_length=ANSWER_MAX)
    return out


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
            "review_status",
            "proposed_by",
            "deleted_at",
            "sessions_used_count",
            "total_responses",
            "total_scores",
            "total_skips",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "proposed_by",
            "deleted_at",
            "sessions_used_count",
            "total_responses",
            "total_scores",
            "total_skips",
            "created_at",
            "updated_at",
        ]

    def validate_review_status(self, value: str) -> str:
        allowed = {c[0] for c in WhatIfQuestion.ReviewStatus.choices}
        if value not in allowed:
            raise serializers.ValidationError("Invalid review status.")
        return value

    def validate(self, attrs: dict) -> dict:
        text_keys = (
            "prompt",
            "answer_1",
            "answer_2",
            "answer_3",
            "answer_4",
            "answer_5",
            "answer_6",
        )
        if self.instance is None:
            try:
                attrs.update(_validate_question_payload(dict(attrs), partial=False))
            except ValueError as exc:
                raise serializers.ValidationError(str(exc)) from exc
            return attrs
        if not any(k in attrs for k in text_keys):
            return attrs
        merged = {f: getattr(self.instance, f) for f in text_keys}
        merged.update({k: attrs[k] for k in text_keys if k in attrs})
        try:
            cleaned = _validate_question_payload(merged, partial=True)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        for k in text_keys:
            if k in attrs:
                attrs[k] = cleaned[k]
        return attrs


class WhatIfQuestionProposeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatIfQuestion
        fields = [
            "prompt",
            "answer_1",
            "answer_2",
            "answer_3",
            "answer_4",
            "answer_5",
            "answer_6",
        ]

    def validate(self, attrs: dict) -> dict:
        try:
            return _validate_question_payload(attrs, partial=False)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


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
