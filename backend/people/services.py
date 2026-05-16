from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q

from people.models import Person, PersonPartnership


def ensure_self_person(user) -> None:
    """Create or revive the owner's self Person row (idempotent, SQLite-safe)."""
    from users.models import Profile

    profile = Profile.objects.filter(user=user).first()
    display = (getattr(profile, "display_name", "") or "").strip() or user.email.split("@")[0]
    display = display[:255]
    bd = getattr(profile, "birth_date", None) if profile else None

    p = (
        Person.objects.filter(owner_user=user, is_self=True, deleted_at__isnull=True)
        .only("id", "name", "birthday")
        .first()
    )
    if p is not None:
        updates: list[str] = []
        if not (p.name or "").strip():
            p.name = display
            updates.append("name")
        if p.birthday is None and bd is not None:
            p.birthday = bd
            updates.append("birthday")
        if updates:
            p.save(update_fields=updates + ["updated_at"])
        return

    soft_deleted = (
        Person.objects.filter(owner_user=user, is_self=True)
        .exclude(deleted_at__isnull=True)
        .only("id", "name", "birthday", "deleted_at")
        .first()
    )
    if soft_deleted is not None:
        soft_deleted.deleted_at = None
        soft_deleted.name = display
        if bd is not None:
            soft_deleted.birthday = bd
        soft_deleted.save(update_fields=["deleted_at", "name", "birthday", "updated_at"])
        return

    try:
        with transaction.atomic():
            Person.objects.create(
                owner_user=user,
                name=display,
                relation_core="self",
                relation_alias="me",
                birthday=bd,
                is_self=True,
                relation_prefix_tokens=[],
                relation_suffix_tokens=[],
            )
    except IntegrityError:
        pass


def partnership_initial_status(*, owner_user_id: int, person_a_id, person_b_id) -> str:
    """
    New partnership defaults to former if either endpoint already participates in
    any current partnership (with anyone).
    """
    current = PersonPartnership.Status.CURRENT
    former = PersonPartnership.Status.FORMER
    exists = PersonPartnership.objects.filter(
        owner_user_id=owner_user_id,
        status=current,
    ).filter(
        Q(person_a_id=person_a_id)
        | Q(person_b_id=person_a_id)
        | Q(person_a_id=person_b_id)
        | Q(person_b_id=person_b_id),
    ).exists()
    return former if exists else current
