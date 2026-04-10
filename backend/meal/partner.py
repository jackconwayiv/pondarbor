from __future__ import annotations

from django.contrib.auth import get_user_model

User = get_user_model()


def mutual_meal_pair(*, user) -> bool:
    """True when both users have selected each other as meal CRUD partner."""
    profile = getattr(user, "profile", None)
    if profile is None:
        return False
    pid = profile.meal_crud_partner_id
    if not pid:
        return False
    try:
        partner = User.objects.select_related("profile").get(pk=pid)
    except User.DoesNotExist:
        return False
    return partner.profile.meal_crud_partner_id == user.id


def incoming_meal_partner_pending(*, user) -> bool:
    """True if someone has selected this user as meal partner but mutual pairing is not complete."""
    from users.models import Profile

    profile = getattr(user, "profile", None)
    my_partner_id = profile.meal_crud_partner_id if profile else None
    for p in Profile.objects.filter(meal_crud_partner_id=user.id).select_related("user"):
        other = p.user
        if mutual_meal_pair(user=user) and my_partner_id == other.id:
            continue
        return True
    return False


def meal_partner_user_ids(*, user) -> set[int]:
    """User ids that may access each other's meal objects (self + mutual partner)."""
    ids = {user.id}
    profile = getattr(user, "profile", None)
    if profile is None:
        return ids
    pid = profile.meal_crud_partner_id
    if pid and mutual_meal_pair(user=user):
        ids.add(pid)
    return ids
