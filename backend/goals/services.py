from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from goals.models import CheckIn, Checkpoint, Goal

UNDO_WINDOW = timedelta(minutes=10)


def can_undo_goal(goal: Goal) -> bool:
    if not goal.last_completion_event_at:
        return False
    return timezone.now() - goal.last_completion_event_at <= UNDO_WINDOW


def completed_goal_editing_locked(goal: Goal) -> bool:
    """Completed goals cannot be edited; use undo within the window instead."""
    return goal.status == Goal.Status.COMPLETED


def _set_completion_event(
    goal: Goal,
    event_type: str,
    checkpoint: Checkpoint | None = None,
) -> None:
    goal.last_completion_event_at = timezone.now()
    goal.last_completion_event_type = event_type
    goal.last_completion_checkpoint = checkpoint
    goal.save(
        update_fields=[
            "last_completion_event_at",
            "last_completion_event_type",
            "last_completion_checkpoint",
            "updated_at",
        ]
    )


@transaction.atomic
def record_check_in(
    goal: Goal,
    owner_user_id: int,
    checkpoint: Checkpoint | None = None,
) -> CheckIn:
    now = timezone.now()
    if goal.kind in (Goal.Kind.CONTINUOUS, Goal.Kind.CHORE) and checkpoint is not None:
        raise ValueError("Ongoing goals and chores cannot link check-ins to checkpoints.")
    if goal.kind == Goal.Kind.CHORE:
        event_type = Goal.LastCompletionEventType.CHECK_IN
    elif goal.kind == Goal.Kind.ONE_TIME:
        if checkpoint is None:
            raise ValueError("Task or project goals must log progress on a checkpoint.")
        if checkpoint.goal_id != goal.id:
            raise ValueError("Checkpoint does not belong to this goal.")
        if not checkpoint.completed_at:
            checkpoint.completed_at = now
            checkpoint.save(update_fields=["completed_at"])
        event_type = Goal.LastCompletionEventType.CHECKPOINT_COMPLETED
    else:
        event_type = Goal.LastCompletionEventType.CHECK_IN

    check_in = CheckIn.objects.create(
        goal=goal,
        owner_user_id=owner_user_id,
        checkpoint=checkpoint,
        occurred_at=now,
    )
    goal.last_check_in_at = now
    goal.save(update_fields=["last_check_in_at", "updated_at"])
    _set_completion_event(goal, event_type, checkpoint)
    return check_in


@transaction.atomic
def complete_goal(goal: Goal) -> Goal:
    now = timezone.now()
    goal.status = Goal.Status.COMPLETED
    goal.completed_at = now
    goal.save(update_fields=["status", "completed_at", "updated_at"])
    _set_completion_event(goal, Goal.LastCompletionEventType.GOAL_COMPLETED, None)
    return goal


@transaction.atomic
def clear_checkpoint_completion(goal: Goal, checkpoint: Checkpoint) -> None:
    """Uncheck a checkpoint: clear completion time and remove its check-in."""
    if not checkpoint.completed_at:
        return
    checkpoint.completed_at = None
    checkpoint.save(update_fields=["completed_at"])
    CheckIn.objects.filter(goal=goal, checkpoint=checkpoint).delete()
    if goal.last_completion_checkpoint_id == checkpoint.id:
        goal.last_completion_event_at = None
        goal.last_completion_event_type = ""
        goal.last_completion_checkpoint = None
    last_ci = CheckIn.objects.filter(goal=goal).order_by("-occurred_at").first()
    goal.last_check_in_at = last_ci.occurred_at if last_ci else None
    goal.save(
        update_fields=[
            "last_completion_event_at",
            "last_completion_event_type",
            "last_completion_checkpoint",
            "last_check_in_at",
            "updated_at",
        ]
    )


@transaction.atomic
def undo_last_completion(goal: Goal) -> None:
    if not can_undo_goal(goal):
        raise ValueError("Undo window expired or no event to undo.")

    event_type = goal.last_completion_event_type
    checkpoint = goal.last_completion_checkpoint

    if event_type == Goal.LastCompletionEventType.GOAL_COMPLETED:
        goal.status = Goal.Status.ACTIVE
        goal.completed_at = None
        goal.save(update_fields=["status", "completed_at", "updated_at"])
    elif event_type == Goal.LastCompletionEventType.CHECKPOINT_COMPLETED and checkpoint:
        checkpoint.completed_at = None
        checkpoint.save(update_fields=["completed_at"])
        latest = (
            CheckIn.objects.filter(goal=goal, checkpoint=checkpoint)
            .order_by("-occurred_at")
            .first()
        )
        if latest:
            latest.delete()
    elif event_type == Goal.LastCompletionEventType.CHECK_IN:
        latest = (
            CheckIn.objects.filter(goal=goal, checkpoint__isnull=True)
            .order_by("-occurred_at")
            .first()
        )
        if latest:
            latest.delete()

    goal.last_completion_event_at = None
    goal.last_completion_event_type = ""
    goal.last_completion_checkpoint = None
    last_ci = CheckIn.objects.filter(goal=goal).order_by("-occurred_at").first()
    goal.last_check_in_at = last_ci.occurred_at if last_ci else None
    goal.save(
        update_fields=[
            "last_completion_event_at",
            "last_completion_event_type",
            "last_completion_checkpoint",
            "last_check_in_at",
            "updated_at",
        ]
    )
