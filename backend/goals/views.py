from __future__ import annotations

from datetime import timedelta

from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from goals.models import Checkpoint, CheckIn, Goal
from goals.serializers import (
    CheckpointCreateSerializer,
    CheckpointPatchSerializer,
    CheckpointSerializer,
    CheckInCreateSerializer,
    GoalCreateSerializer,
    GoalPatchSerializer,
    GoalSerializer,
    GoalsResetSerializer,
)
from goals.services import (
    can_undo_goal,
    complete_goal,
    completed_goal_editing_locked,
    record_check_in,
    undo_last_completion,
)
from goals.stats import (
    compute_goal_stats,
    compute_period_stripe,
    sort_goals_for_display,
)
from users.models import Profile, User
from users.permissions import IsApprovedUser


def _require_approved(request):
    if not request.user or not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if request.user.account_status != User.AccountStatus.APPROVED:
        return Response({"detail": IsApprovedUser.message}, status=status.HTTP_403_FORBIDDEN)
    return None


def _goals_qs(user):
    return Goal.objects.filter(owner_user=user).prefetch_related(
        Prefetch("checkpoints", queryset=Checkpoint.objects.order_by("sort_order", "created_at")),
    )


def _profile_for(user) -> Profile | None:
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def _occurrences_for_goals(goal_ids, owner_user_id, since):
    rows = CheckIn.objects.filter(
        goal_id__in=goal_ids,
        owner_user_id=owner_user_id,
        occurred_at__gte=since,
    ).values_list("goal_id", "occurred_at", "checkpoint_id")
    from collections import defaultdict

    out = defaultdict(list)
    for gid, occurred_at, cp_id in rows:
        out[gid].append((occurred_at, cp_id))
    return out


def _checkpoint_times(goal: Goal) -> list:
    return [cp.completed_at for cp in goal.checkpoints.all() if cp.completed_at]


def _serialized_goal_response(request, goal: Goal) -> Response:
    profile = _profile_for(request.user)
    since = timezone.now() - timedelta(days=400)
    occ = list(
        CheckIn.objects.filter(
            goal=goal,
            owner_user=request.user,
            occurred_at__gte=since,
        ).values_list("occurred_at", "checkpoint_id")
    )
    stats = compute_goal_stats(goal, occ, _checkpoint_times(goal), profile)
    due_map = {goal.id: _goal_due_today(goal, stats, profile)}
    return Response(
        GoalSerializer(
            goal,
            context={"stats_bundle": {goal.id: stats}, "profile": profile, "due_today_map": due_map},
        ).data
    )


def _evaluate_goals_achievements(user) -> None:
    from achievements.services import evaluate_goals_achievements_for_user

    evaluate_goals_achievements_for_user(user.id)


def _locked_goal_response(goal: Goal):
    if completed_goal_editing_locked(goal):
        return Response(
            {"detail": "This completed goal is locked and cannot be changed."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _build_stats_bundle(goals, owner_user_id, profile):
    since = timezone.now() - timedelta(days=400)
    by_goal = _occurrences_for_goals([g.id for g in goals], owner_user_id, since)
    bundle = {}
    for g in goals:
        occ = by_goal.get(g.id, [])
        bundle[g.id] = compute_goal_stats(g, occ, _checkpoint_times(g), profile)
    return bundle


def _goal_due_today(goal: Goal, stats, profile: Profile | None) -> bool:
    if goal.status != Goal.Status.ACTIVE:
        return False
    if goal.kind == Goal.Kind.ONE_TIME:
        return True
    if goal.kind == Goal.Kind.CONTINUOUS:
        from goals.stats import goal_visible_in_due_list

        return goal_visible_in_due_list(goal, stats)
    if goal.kind == Goal.Kind.CHORE:
        from goals.chore_stats import chore_visible_in_due_list
        from goals.stats import _user_tz, _week_starts_on, local_today

        tz = _user_tz(profile)
        today = local_today(timezone.now(), tz)
        wso = _week_starts_on(profile)
        return chore_visible_in_due_list(goal, today, tz, wso, stats)
    return False


def _due_today_map(goals, bundle, profile) -> dict:
    return {g.id: _goal_due_today(g, bundle[g.id], profile) for g in goals}


def _serialize_goals(goals, bundle, profile, due_today_map: dict | None = None):
    if due_today_map is None:
        due_today_map = _due_today_map(goals, bundle, profile)
    return [
        GoalSerializer(
            g,
            context={
                "stats_bundle": {g.id: bundle[g.id]},
                "profile": profile,
                "due_today_map": due_today_map,
            },
        ).data
        for g in goals
    ]


def _dashboard_counts(all_goals):
    status_counts = {
        Goal.Status.ACTIVE: sum(1 for g in all_goals if g.status == Goal.Status.ACTIVE),
        Goal.Status.COMPLETED: sum(1 for g in all_goals if g.status == Goal.Status.COMPLETED),
        Goal.Status.PAUSED: sum(1 for g in all_goals if g.status == Goal.Status.PAUSED),
    }
    kind_counts = {
        Goal.Kind.CONTINUOUS: sum(
            1 for g in all_goals if g.kind == Goal.Kind.CONTINUOUS and g.status == Goal.Status.ACTIVE
        ),
        Goal.Kind.CHORE: sum(
            1 for g in all_goals if g.kind == Goal.Kind.CHORE and g.status == Goal.Status.ACTIVE
        ),
        Goal.Kind.ONE_TIME: sum(
            1 for g in all_goals if g.kind == Goal.Kind.ONE_TIME and g.status == Goal.Status.ACTIVE
        ),
    }
    kind_totals = {
        Goal.Kind.CONTINUOUS: sum(1 for g in all_goals if g.kind == Goal.Kind.CONTINUOUS),
        Goal.Kind.CHORE: sum(1 for g in all_goals if g.kind == Goal.Kind.CHORE),
        Goal.Kind.ONE_TIME: sum(1 for g in all_goals if g.kind == Goal.Kind.ONE_TIME),
    }
    return status_counts, kind_counts, kind_totals


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def goals_dashboard(request):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    scope = request.query_params.get("scope")
    all_goals = list(_goals_qs(user))
    profile = _profile_for(user)
    stripe = compute_period_stripe(all_goals, user.id, profile)
    status_counts, kind_counts, kind_totals = _dashboard_counts(all_goals)

    stripe_payload = {
        "today_actual": stripe.today_actual,
        "today_target": stripe.today_target,
        "week_actual": stripe.week_actual,
        "week_target": stripe.week_target,
        "month_actual": stripe.month_actual,
        "month_target": stripe.month_target,
    }

    if scope == "all":
        bundle = _build_stats_bundle(all_goals, user.id, profile)
        due_map = _due_today_map(all_goals, bundle, profile)
        sorted_pairs = sort_goals_for_display([(g, bundle[g.id]) for g in all_goals])
        sorted_goals = [g for g, _ in sorted_pairs]
        goals_payload = _serialize_goals(sorted_goals, bundle, profile, due_map)
        return Response(
            {
                "stripe": stripe_payload,
                "goals": goals_payload,
                "status_counts": status_counts,
                "kind_counts": kind_counts,
                "kind_totals": kind_totals,
                "scope": "all",
            }
        )

    status_filter = request.query_params.get("status", Goal.Status.ACTIVE)
    if status_filter not in (Goal.Status.ACTIVE, Goal.Status.COMPLETED, Goal.Status.PAUSED):
        status_filter = Goal.Status.ACTIVE

    kind_filter = request.query_params.get("kind")
    if kind_filter not in (None, Goal.Kind.CONTINUOUS, Goal.Kind.CHORE, Goal.Kind.ONE_TIME):
        kind_filter = None

    chores_due_only = request.query_params.get("chores_due_only", "true").lower() != "false"

    filtered = [g for g in all_goals if g.status == status_filter]
    if kind_filter:
        filtered = [g for g in filtered if g.kind == kind_filter]

    bundle = _build_stats_bundle(filtered, user.id, profile)

    if kind_filter == Goal.Kind.CHORE and chores_due_only and status_filter == Goal.Status.ACTIVE:
        from goals.chore_stats import chore_visible_in_due_list
        from goals.stats import _user_tz, _week_starts_on, local_today

        tz = _user_tz(profile)
        today = local_today(timezone.now(), tz)
        wso = _week_starts_on(profile)
        filtered = [
            g
            for g in filtered
            if chore_visible_in_due_list(g, today, tz, wso, bundle[g.id])
        ]

    if kind_filter == Goal.Kind.CONTINUOUS and status_filter == Goal.Status.ACTIVE:
        from goals.stats import goal_visible_in_due_list

        filtered = [g for g in filtered if goal_visible_in_due_list(g, bundle[g.id])]

    sorted_pairs = sort_goals_for_display([(g, bundle[g.id]) for g in filtered])
    sorted_goals = [g for g, _ in sorted_pairs]
    goals_payload = _serialize_goals(sorted_goals, bundle, profile)

    return Response(
        {
            "stripe": stripe_payload,
            "goals": goals_payload,
            "status": status_filter,
            "status_counts": status_counts,
            "kind_counts": kind_counts,
            "kind_totals": kind_totals,
            "kind": kind_filter,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def goals_reset(request):
    err = _require_approved(request)
    if err:
        return err
    ser = GoalsResetSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    deleted, _ = Goal.objects.filter(owner_user=request.user).delete()
    _evaluate_goals_achievements(request.user)
    return Response({"deleted": deleted})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def goals_collection(request):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    if request.method == "GET":
        status_filter = request.query_params.get("status", Goal.Status.ACTIVE)
        goals = list(_goals_qs(user).filter(status=status_filter))
        profile = _profile_for(user)
        bundle = _build_stats_bundle(goals, user.id, profile)
        return Response(
            [
                GoalSerializer(g, context={"stats_bundle": bundle, "profile": profile}).data
                for g in goals
            ]
        )
    ser = GoalCreateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    goal = ser.save()
    goal = _goals_qs(user).get(pk=goal.pk)
    _evaluate_goals_achievements(user)
    profile = _profile_for(user)
    stats = compute_goal_stats(goal, [], [], profile)
    return Response(
        GoalSerializer(goal, context={"stats_bundle": {goal.id: stats}, "profile": profile}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def goals_detail(request, goal_id):
    err = _require_approved(request)
    if err:
        return err
    goal = get_object_or_404(_goals_qs(request.user), pk=goal_id)
    if request.method == "GET":
        profile = _profile_for(request.user)
        since = timezone.now() - timedelta(days=400)
        occ = list(
            CheckIn.objects.filter(goal=goal, owner_user=request.user, occurred_at__gte=since).values_list(
                "occurred_at", "checkpoint_id"
            )
        )
        stats = compute_goal_stats(goal, occ, _checkpoint_times(goal), profile)
        return Response(
            GoalSerializer(goal, context={"stats_bundle": {goal.id: stats}, "profile": profile}).data
        )
    if request.method == "DELETE":
        locked = _locked_goal_response(goal)
        if locked:
            return locked
        goal.delete()
        _evaluate_goals_achievements(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
    locked = _locked_goal_response(goal)
    if locked:
        return locked
    ser = GoalPatchSerializer(
        data=request.data,
        partial=True,
        context={"request": request, "goal": goal},
    )
    ser.is_valid(raise_exception=True)
    new_status = ser.validated_data.get("status")
    if new_status == Goal.Status.COMPLETED:
        ser.update(goal, {k: v for k, v in ser.validated_data.items() if k != "status"})
        complete_goal(goal)
    else:
        ser.update(goal, ser.validated_data)
    goal = _goals_qs(request.user).get(pk=goal.pk)
    _evaluate_goals_achievements(request.user)
    return _serialized_goal_response(request, goal)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def goals_check_in(request, goal_id):
    err = _require_approved(request)
    if err:
        return err
    goal = get_object_or_404(
        _goals_qs(request.user).filter(status=Goal.Status.ACTIVE),
        pk=goal_id,
    )
    ser = CheckInCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    cp_id = ser.validated_data.get("checkpoint_id")
    checkpoint = None
    if cp_id:
        checkpoint = get_object_or_404(Checkpoint, pk=cp_id, goal=goal)
    try:
        record_check_in(goal, request.user.id, checkpoint)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    goal = _goals_qs(request.user).get(pk=goal.pk)
    _evaluate_goals_achievements(request.user)
    return _serialized_goal_response(request, goal)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def goals_undo(request, goal_id):
    err = _require_approved(request)
    if err:
        return err
    goal = get_object_or_404(_goals_qs(request.user), pk=goal_id)
    if not can_undo_goal(goal):
        return Response({"detail": "Nothing to undo or window expired."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        undo_last_completion(goal)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    goal = _goals_qs(request.user).get(pk=goal.pk)
    profile = _profile_for(request.user)
    since = timezone.now() - timedelta(days=400)
    occ = list(
        CheckIn.objects.filter(goal=goal, owner_user=request.user, occurred_at__gte=since).values_list(
            "occurred_at", "checkpoint_id"
        )
    )
    stats = compute_goal_stats(goal, occ, _checkpoint_times(goal), profile)
    _evaluate_goals_achievements(request.user)
    return Response(
        GoalSerializer(goal, context={"stats_bundle": {goal.id: stats}, "profile": profile}).data
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def goals_checkpoints_collection(request, goal_id):
    err = _require_approved(request)
    if err:
        return err
    goal = get_object_or_404(_goals_qs(request.user), pk=goal_id)
    if goal.kind != Goal.Kind.ONE_TIME:
        return Response({"detail": "Checkpoints only for one-time goals."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "GET":
        return Response(CheckpointSerializer(goal.checkpoints.all(), many=True).data)
    locked = _locked_goal_response(goal)
    if locked:
        return locked
    ser = CheckpointCreateSerializer(data=request.data, context={"goal": goal})
    ser.is_valid(raise_exception=True)
    cp = ser.save()
    return Response(CheckpointSerializer(cp).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def goals_checkpoint_detail(request, goal_id, checkpoint_id):
    err = _require_approved(request)
    if err:
        return err
    goal = get_object_or_404(_goals_qs(request.user), pk=goal_id)
    if goal.kind != Goal.Kind.ONE_TIME:
        return Response({"detail": "Checkpoints only for one-time goals."}, status=status.HTTP_400_BAD_REQUEST)
    cp = get_object_or_404(Checkpoint, pk=checkpoint_id, goal=goal)
    locked = _locked_goal_response(goal)
    if request.method == "DELETE":
        if locked:
            return locked
        cp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if locked:
        return locked
    if goal.status != Goal.Status.ACTIVE:
        return Response(
            {"detail": "Only active goals can change checkpoints."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = CheckpointPatchSerializer(
        data=request.data,
        partial=True,
        context={"goal": goal, "owner_user_id": request.user.id},
    )
    ser.is_valid(raise_exception=True)
    ser.update(cp, ser.validated_data)
    goal = _goals_qs(request.user).get(pk=goal.pk)
    _evaluate_goals_achievements(request.user)
    return _serialized_goal_response(request, goal)
