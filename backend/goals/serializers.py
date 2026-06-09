from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from goals.models import Checkpoint, Goal
from goals.stats import GoalStats
from goals.validation import (
    MAX_CHECKPOINTS_PER_GOAL,
    normalize_frequency_count,
    normalize_optional_description,
    normalize_required_title,
    validate_choice,
)

_GOAL_KINDS = {c.value for c in Goal.Kind}
_GOAL_STATUSES = {c.value for c in Goal.Status}
_INTERVAL_KINDS = {c.value for c in Goal.ScheduleIntervalKind}


class CheckpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = (
            "id",
            "title",
            "sort_order",
            "completed_at",
            "created_at",
        )
        read_only_fields = ("id", "completed_at", "created_at")


class GoalStatsSerializer(serializers.Serializer):
    streak_current = serializers.IntegerField()
    streak_best = serializers.IntegerField()
    pct_lifetime = serializers.FloatField()
    pct_last_30_days = serializers.FloatField()
    days_since_last_progress = serializers.IntegerField()
    today_actual = serializers.IntegerField()
    today_target = serializers.IntegerField()
    week_actual = serializers.IntegerField()
    week_target = serializers.IntegerField()
    month_actual = serializers.IntegerField()
    month_target = serializers.IntegerField()
    urgency_score = serializers.FloatField()
    days_overdue = serializers.IntegerField()
    chore_period_state = serializers.CharField()
    count_completed_on_time = serializers.IntegerField()
    count_completed_overdue = serializers.IntegerField()
    count_missed = serializers.IntegerField()
    count_completed = serializers.IntegerField()
    pct_completed_on_time = serializers.FloatField()
    pct_completed_overdue = serializers.FloatField()
    pct_completed_missed = serializers.FloatField()


def stats_to_dict(stats: GoalStats) -> dict:
    return GoalStatsSerializer(stats).data


def _validate_schedule_fields(attrs: dict, goal: Goal | None = None) -> None:
    kind = attrs.get("schedule_interval_kind")
    if kind is None and goal is not None:
        kind = goal.schedule_interval_kind

    if kind == Goal.ScheduleIntervalKind.WEEKDAY:
        weekday = attrs.get("schedule_weekday")
        if weekday is None and goal is not None:
            weekday = goal.schedule_weekday
        if weekday is None:
            raise serializers.ValidationError(
                {"schedule_weekday": "Required for weekday schedule."}
            )
        attrs.setdefault("schedule_interval_weeks", 1)
    elif kind == Goal.ScheduleIntervalKind.WEEKS:
        weeks = attrs.get("schedule_interval_weeks")
        if weeks is None and goal is not None:
            weeks = goal.schedule_interval_weeks
        if weeks is None or weeks < 1:
            raise serializers.ValidationError(
                {"schedule_interval_weeks": "Must be at least 1 for every-N-weeks schedule."}
            )
    elif kind == Goal.ScheduleIntervalKind.MONTHS:
        months = attrs.get("schedule_interval_months")
        if months is None and goal is not None:
            months = goal.schedule_interval_months
        if months is None or months < 1:
            raise serializers.ValidationError(
                {"schedule_interval_months": "Must be at least 1 for every-N-months schedule."}
            )
    elif kind == Goal.ScheduleIntervalKind.MONTH_DAY:
        dom = attrs.get("schedule_month_day")
        if dom is None and goal is not None:
            dom = goal.schedule_month_day
        if dom is None:
            raise serializers.ValidationError(
                {"schedule_month_day": "Required for month-day schedule."}
            )
        if dom < 1 or dom > 31:
            raise serializers.ValidationError(
                {"schedule_month_day": "Must be between 1 and 31."}
            )


class GoalSerializer(serializers.ModelSerializer):
    checkpoints = CheckpointSerializer(many=True, read_only=True)
    stats = serializers.SerializerMethodField()
    can_undo = serializers.SerializerMethodField()
    due_today = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = (
            "id",
            "title",
            "description",
            "kind",
            "status",
            "schedule_interval_kind",
            "frequency_count",
            "schedule_weekday",
            "schedule_interval_weeks",
            "schedule_interval_months",
            "schedule_month_day",
            "completed_at",
            "last_check_in_at",
            "created_at",
            "updated_at",
            "checkpoints",
            "stats",
            "can_undo",
            "due_today",
        )
        read_only_fields = (
            "id",
            "completed_at",
            "last_check_in_at",
            "created_at",
            "updated_at",
            "checkpoints",
            "stats",
            "can_undo",
            "due_today",
        )

    def get_stats(self, obj: Goal) -> dict:
        bundle = self.context.get("stats_bundle", {})
        stats = bundle.get(obj.id)
        if stats is None:
            from goals.stats import compute_goal_stats

            stats = compute_goal_stats(obj, [], [], self.context.get("profile"))
        return stats_to_dict(stats)

    def get_can_undo(self, obj: Goal) -> bool:
        from goals.services import can_undo_goal

        return can_undo_goal(obj)

    def get_due_today(self, obj: Goal) -> bool:
        due_map = self.context.get("due_today_map")
        if due_map is not None:
            return bool(due_map.get(obj.id, False))
        return False


class CheckpointCreateNestedSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    sort_order = serializers.IntegerField(required=False, default=0, min_value=0, max_value=9999)

    def validate_title(self, value: str) -> str:
        return normalize_required_title(value, field="title")


class GoalCreateSerializer(serializers.ModelSerializer):
    checkpoints = CheckpointCreateNestedSerializer(many=True, required=False)

    class Meta:
        model = Goal
        fields = (
            "title",
            "description",
            "kind",
            "schedule_interval_kind",
            "frequency_count",
            "schedule_weekday",
            "schedule_interval_weeks",
            "schedule_interval_months",
            "schedule_month_day",
            "checkpoints",
        )

    def validate_title(self, value: str) -> str:
        return normalize_required_title(value)

    def validate_description(self, value: str) -> str:
        return normalize_optional_description(value)

    def validate_kind(self, value: str) -> str:
        return validate_choice(value, field="kind", choices=_GOAL_KINDS)

    def validate_schedule_interval_kind(self, value: str) -> str:
        return validate_choice(value, field="schedule_interval_kind", choices=_INTERVAL_KINDS)

    def validate_frequency_count(self, value: int) -> int:
        return normalize_frequency_count(value)

    def validate_checkpoints(self, value: list) -> list:
        if len(value) > MAX_CHECKPOINTS_PER_GOAL:
            raise serializers.ValidationError(
                f"At most {MAX_CHECKPOINTS_PER_GOAL} checkpoints per goal."
            )
        return value

    def validate(self, attrs):
        kind = attrs.get("kind")
        if kind in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
            attrs.setdefault("schedule_interval_kind", Goal.ScheduleIntervalKind.DAY)
            attrs.setdefault("frequency_count", 1)
            attrs.setdefault("schedule_interval_weeks", 1)
            attrs.setdefault("schedule_interval_months", 2)
            _validate_schedule_fields(attrs)
            if kind == Goal.Kind.CHORE and attrs.get("checkpoints"):
                raise serializers.ValidationError(
                    {"checkpoints": "Chores cannot have checkpoints."}
                )
        elif kind == Goal.Kind.ONE_TIME:
            attrs["schedule_interval_kind"] = Goal.ScheduleIntervalKind.DAY
            attrs["frequency_count"] = 1
        return attrs

    def create(self, validated_data):
        checkpoints_data = validated_data.pop("checkpoints", [])
        request = self.context["request"]
        goal = Goal.objects.create(
            owner_user=request.user,
            status=Goal.Status.ACTIVE,
            **validated_data,
        )
        for i, cp in enumerate(checkpoints_data):
            Checkpoint.objects.create(
                goal=goal,
                title=cp.get("title", ""),
                sort_order=cp.get("sort_order", i),
            )
        return goal


class GoalPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = (
            "title",
            "description",
            "kind",
            "status",
            "schedule_interval_kind",
            "frequency_count",
            "schedule_weekday",
            "schedule_interval_weeks",
            "schedule_interval_months",
            "schedule_month_day",
        )

    def validate_title(self, value: str) -> str:
        return normalize_required_title(value)

    def validate_description(self, value: str) -> str:
        return normalize_optional_description(value)

    def validate_kind(self, value: str) -> str:
        return validate_choice(value, field="kind", choices=_GOAL_KINDS)

    def validate_status(self, value: str) -> str:
        return validate_choice(value, field="status", choices=_GOAL_STATUSES)

    def validate_schedule_interval_kind(self, value: str) -> str:
        return validate_choice(value, field="schedule_interval_kind", choices=_INTERVAL_KINDS)

    def validate_frequency_count(self, value: int) -> int:
        return normalize_frequency_count(value)

    def validate(self, attrs):
        goal: Goal = self.context["goal"]
        kind = attrs.get("kind", goal.kind)
        if kind == Goal.Kind.ONE_TIME:
            attrs.pop("schedule_interval_kind", None)
        new_status = attrs.get("status")
        if goal.kind == Goal.Kind.CHORE and new_status == Goal.Status.COMPLETED:
            raise serializers.ValidationError(
                {"status": "Chores cannot be marked completed. Pause or delete instead."}
            )
        if kind == Goal.Kind.CHORE and new_status == Goal.Status.COMPLETED:
            raise serializers.ValidationError(
                {"status": "Chores cannot be marked completed. Pause or delete instead."}
            )
        if kind in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE):
            _validate_schedule_fields(attrs, goal)
        return attrs

    def update(self, instance: Goal, validated_data):
        new_status = validated_data.get("status")
        if new_status == Goal.Status.COMPLETED and instance.status != Goal.Status.COMPLETED:
            instance.completed_at = timezone.now()
        elif new_status in (Goal.Status.ACTIVE, Goal.Status.PAUSED):
            if "status" in validated_data and new_status != Goal.Status.COMPLETED:
                instance.completed_at = None
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class CheckpointCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = ("title", "sort_order")

    def validate_title(self, value: str) -> str:
        return normalize_required_title(value, field="title")

    def validate_sort_order(self, value: int) -> int:
        if value < 0 or value > 9999:
            raise serializers.ValidationError("Invalid sort order.")
        return value

    def validate(self, attrs):
        goal: Goal = self.context["goal"]
        if goal.checkpoints.count() >= MAX_CHECKPOINTS_PER_GOAL:
            raise serializers.ValidationError(
                f"At most {MAX_CHECKPOINTS_PER_GOAL} checkpoints per goal."
            )
        return attrs

    def create(self, validated_data):
        goal: Goal = self.context["goal"]
        if goal.kind != Goal.Kind.ONE_TIME:
            raise serializers.ValidationError("Checkpoints are only for one-time goals.")
        return Checkpoint.objects.create(goal=goal, **validated_data)


class CheckpointPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = ("title", "sort_order", "completed_at")

    def validate_title(self, value: str) -> str:
        return normalize_required_title(value, field="title")

    def validate_sort_order(self, value: int) -> int:
        if value < 0 or value > 9999:
            raise serializers.ValidationError("Invalid sort order.")
        return value

    def validate_completed_at(self, value):
        if value is not None:
            raise serializers.ValidationError(
                "Cannot set completion time directly. Check the checkpoint or use check-in."
            )
        return value

    def update(self, instance: Checkpoint, validated_data):
        from goals.services import clear_checkpoint_completion

        goal: Goal = self.context["goal"]

        if "completed_at" in validated_data:
            clear_checkpoint_completion(goal, instance)
            validated_data.pop("completed_at")

        for k, v in validated_data.items():
            setattr(instance, k, v)
        if validated_data:
            instance.save()
        return instance


class CheckInCreateSerializer(serializers.Serializer):
    checkpoint_id = serializers.UUIDField(required=False, allow_null=True)


class GoalsResetSerializer(serializers.Serializer):
    confirm = serializers.CharField(max_length=32)

    def validate_confirm(self, value: str) -> str:
        if value != "delete_all":
            raise serializers.ValidationError("Invalid confirmation.")
        return value
