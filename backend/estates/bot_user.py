from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model

from .constants import ESTATES_COMPUTER_USER_EMAIL

_user_model = get_user_model()
_cached_computer_user_id: int | None = None


def get_computer_user():
    global _cached_computer_user_id
    email = getattr(settings, "ESTATES_COMPUTER_USER_EMAIL", ESTATES_COMPUTER_USER_EMAIL)
    if _cached_computer_user_id is not None:
        user = _user_model.objects.filter(pk=_cached_computer_user_id).first()
        if user is not None:
            return user
    return _user_model.objects.get(email=email)


def is_computer_user(user) -> bool:
    if user is None:
        return False
    try:
        return int(user.id) == int(get_computer_user().id)
    except _user_model.DoesNotExist:
        return False
