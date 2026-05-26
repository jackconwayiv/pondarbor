"""Keep Profile.birth_date and AstroProfile.birth_date aligned."""

from __future__ import annotations

from datetime import date

from users.models import Profile, User
from zodiac.models import AstroProfile


def sync_birth_date_across_profiles(*, user: User, birth_date: date | None) -> None:
    """Mirror birth_date on the member Profile and AstroProfile when they exist."""
    profile = Profile.objects.filter(user=user).first()
    if profile is not None and profile.birth_date != birth_date:
        profile.birth_date = birth_date
        profile.save(update_fields=["birth_date"])

    try:
        astro = AstroProfile.objects.get(user=user)
    except AstroProfile.DoesNotExist:
        return
    if astro.birth_date != birth_date:
        astro.birth_date = birth_date
        astro.save(update_fields=["birth_date"])
