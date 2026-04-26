"""Link Slack workspace users to PondArbor accounts using Auth0 /userinfo payloads."""

from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.models import AbstractBaseUser

from .models import SlackIdentity

logger = logging.getLogger(__name__)


def sync_slack_identity_from_auth0_userinfo(
    user: AbstractBaseUser, userinfo: dict[str, Any] | None
) -> None:
    """
    Persist Slack team + member IDs from Auth0's `identities` array (Slack social / legacy).

    Does not depend on `sub` shape (`slack|…` vs `oauth2|slack|…`). Skips entries without
    both `team_id` and Slack user id so ArborBot can resolve `/song` and Events the same way
    as rows created via `users.info` + email.
    """
    if not user or not getattr(user, "pk", None):
        return
    if not isinstance(userinfo, dict):
        return
    identities = userinfo.get("identities")
    if not isinstance(identities, list):
        return
    for ident in identities:
        if not isinstance(ident, dict):
            continue
        if (str(ident.get("provider") or "")).lower() != "slack":
            continue
        slack_user_id = (str(ident.get("user_id") or "")).strip()
        profile_data = ident.get("profileData")
        if not isinstance(profile_data, dict):
            profile_data = {}
        team_id = (str(profile_data.get("team_id") or "")).strip()
        if not slack_user_id or not team_id:
            continue
        if len(slack_user_id) > 32 or len(team_id) > 32:
            logger.warning(
                "Auth0 Slack identity skipped: id length team=%s user=%s",
                len(team_id),
                len(slack_user_id),
            )
            continue
        try:
            SlackIdentity.objects.update_or_create(
                team_id=team_id,
                slack_user_id=slack_user_id,
                defaults={"user": user},
            )
        except Exception:
            logger.exception(
                "Failed to sync SlackIdentity from Auth0 for user_id=%s team=%s",
                slack_user_id,
                team_id,
            )
