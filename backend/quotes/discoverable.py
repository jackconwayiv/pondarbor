"""Quotes discoverable to any approved PondArbor user (used for Slack /randomquote)."""

from __future__ import annotations

from django.db.models import Q, QuerySet

from quotes.models import Quote
from users.models import Profile, User


def discoverable_published_quotes_qs() -> QuerySet[Quote]:
    """
    Published quotes whose owners share with all approved users.

    Matches owners with ``social_publish_visibility=all_approved`` (or no profile).
    Excludes friends-only publishers and non-approved owners.
    """
    return (
        Quote.objects.filter(
            deleted_at__isnull=True,
            visibility=Quote.Visibility.PUBLISHED,
            owner__account_status=User.AccountStatus.APPROVED,
        )
        .filter(
            Q(owner__profile__social_publish_visibility=Profile.SocialPublishVisibility.ALL_APPROVED)
            | Q(owner__profile__isnull=True)
        )
        .select_related("owner", "owner__profile")
        .prefetch_related("labels")
    )


def random_discoverable_published_quote() -> Quote | None:
    return discoverable_published_quotes_qs().order_by("?").first()
