from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from achievements.services import evaluate_people_achievements_for_user
from people.models import Person, PersonGuardianLink, PersonPartnership
from people.serializers import (
    GuardianLinkSerializer,
    PersonCreateSerializer,
    PersonPatchSerializer,
    PersonSerializer,
    PartnershipCreateSerializer,
    graph_bundle_for_owner,
)
from people.services import ensure_self_person
from users.models import User
from users.permissions import IsApprovedUser
from users.social_privacy import can_view_owner_profile


def _require_approved(request):
    if not request.user or not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if request.user.account_status != User.AccountStatus.APPROVED:
        return Response({"detail": IsApprovedUser.message}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def people_summary(request):
    err = _require_approved(request)
    if err:
        return err
    ensure_self_person(request.user)
    n = Person.objects.filter(owner_user=request.user, deleted_at__isnull=True).count()
    return Response({"count": n})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def people_collection(request):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    if request.method == "GET":
        ensure_self_person(user)
        return Response(graph_bundle_for_owner(owner_id=user.id))
    # POST
    ser = PersonCreateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        person = ser.save()
    evaluate_people_achievements_for_user(user.id)
    return Response(PersonSerializer(person).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def people_detail(request, person_id):
    err = _require_approved(request)
    if err:
        return err
    person = get_object_or_404(
        Person.objects.filter(owner_user=request.user, deleted_at__isnull=True),
        pk=person_id,
    )
    if request.method == "GET":
        return Response(PersonSerializer(person).data)
    if request.method == "DELETE":
        if person.is_self:
            return Response({"detail": "Cannot delete your self person."}, status=status.HTTP_400_BAD_REQUEST)
        person.deleted_at = timezone.now()
        person.save(update_fields=["deleted_at", "updated_at"])
        evaluate_people_achievements_for_user(request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = PersonPatchSerializer(
        data=request.data,
        partial=True,
        context={"request": request, "person": person},
    )
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        ser.update(person, ser.validated_data)
    person.refresh_from_db()
    evaluate_people_achievements_for_user(request.user.id)
    return Response(PersonSerializer(person).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def people_partnerships(request):
    err = _require_approved(request)
    if err:
        return err
    ser = PartnershipCreateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        row = ser.save()
    evaluate_people_achievements_for_user(request.user.id)
    return Response(
        {
            "id": str(row.id),
            "person_a_id": str(row.person_a_id),
            "person_b_id": str(row.person_b_id),
            "status": row.status,
            "anniversary_date": row.anniversary_date,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def people_partnership_detail(request, partnership_id):
    err = _require_approved(request)
    if err:
        return err
    row = get_object_or_404(
        PersonPartnership.objects.filter(owner_user=request.user),
        pk=partnership_id,
    )
    if request.method == "DELETE":
        row.delete()
        evaluate_people_achievements_for_user(request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)
    status_v = request.data.get("status")
    ann = request.data.get("anniversary_date")
    if status_v is not None:
        if status_v not in dict(PersonPartnership.Status.choices):
            return Response({"detail": "Invalid status."}, status=400)
        row.status = status_v
    if "anniversary_date" in request.data:
        row.anniversary_date = ann
    row.save()
    evaluate_people_achievements_for_user(request.user.id)
    return Response(
        {
            "id": str(row.id),
            "person_a_id": str(row.person_a_id),
            "person_b_id": str(row.person_b_id),
            "status": row.status,
            "anniversary_date": row.anniversary_date,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def people_guardian_create(request, person_id):
    err = _require_approved(request)
    if err:
        return err
    child = get_object_or_404(
        Person.objects.filter(owner_user=request.user, deleted_at__isnull=True),
        pk=person_id,
    )
    ser = GuardianLinkSerializer(data=request.data, context={"request": request, "child": child})
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        link = ser.save()
    evaluate_people_achievements_for_user(request.user.id)
    return Response(
        {"id": str(link.id), "child_id": str(link.child_id), "guardian_id": str(link.guardian_id), "note": link.note},
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def people_guardian_detail(request, person_id, link_id):
    err = _require_approved(request)
    if err:
        return err
    get_object_or_404(
        Person.objects.filter(owner_user=request.user, deleted_at__isnull=True),
        pk=person_id,
    )
    link = get_object_or_404(
        PersonGuardianLink.objects.filter(owner_user=request.user, child_id=person_id),
        pk=link_id,
    )
    link.delete()
    evaluate_people_achievements_for_user(request.user.id)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def people_friend_bundle(request, owner_user_id: int):
    err = _require_approved(request)
    if err:
        return err
    if request.user.id == owner_user_id:
        return Response({"detail": "Use /api/v1/people/ for your own tree."}, status=status.HTTP_400_BAD_REQUEST)
    owner = get_object_or_404(User.objects.all(), pk=owner_user_id)
    if not can_view_owner_profile(viewer=request.user, owner=owner):
        return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
    return Response(graph_bundle_for_owner(owner_id=owner.id))
