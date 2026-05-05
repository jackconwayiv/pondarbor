import json
import logging
import time

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, OperationalError
from jose import jwt
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from common.jwks import get_auth0_jwks
from slack_integration.auth0_identity import sync_slack_identity_from_auth0_userinfo

from .models import Profile

User = get_user_model()

logger = logging.getLogger(__name__)


def _auth0_issuer() -> str:
    raw = (settings.AUTH0_ISSUER or "").strip()
    if raw:
        return raw if raw.endswith("/") else f"{raw}/"
    return f"https://{settings.AUTH0_DOMAIN}/"


def _clip(value: str, max_len: int) -> str:
    if not value or max_len <= 0:
        return value
    return value if len(value) <= max_len else value[:max_len]


def _sub_may_be_slack(sub: str) -> bool:
    """True when Auth0 `sub` likely belongs to Slack — used to fetch /userinfo for `identities`."""
    s = (sub or "").strip().lower()
    if not s:
        return False
    if s.startswith("slack|"):
        return True
    return "oauth2|slack" in s


def authenticate_bearer_token(token: str):
    """Validate Auth0 JWT and return ``(user, auth_payload)``.

    Raises ``AuthenticationFailed`` on error. Used by REST and WebSocket auth.
    """
    if not settings.AUTH0_DOMAIN or not settings.AUTH0_API_AUDIENCE:
        raise exceptions.AuthenticationFailed(
            "Auth0 is not configured (AUTH0_DOMAIN / AUTH0_API_AUDIENCE)."
        )
    token = (token or "").strip()
    if not token:
        raise exceptions.AuthenticationFailed("Missing token.")

    t_auth_start = time.perf_counter()
    timing_enabled = bool(getattr(settings, "AUTH0_AUTH_TIMING_LOG", False))
    userinfo_ms = 0.0
    save_user_ms = 0.0
    save_profile_ms = 0.0

    try:
        jwks = get_auth0_jwks()
    except requests.RequestException:
        raise exceptions.AuthenticationFailed("Unable to fetch Auth0 JWKS.")

    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise exceptions.AuthenticationFailed("Invalid token header.")

    rsa_key = next(
        (
            {
                "kty": key.get("kty"),
                "kid": key.get("kid"),
                "use": key.get("use"),
                "n": key.get("n"),
                "e": key.get("e"),
            }
            for key in jwks.get("keys", [])
            if key.get("kid") == unverified_header.get("kid")
            and key.get("kty")
            and key.get("n")
            and key.get("e")
        ),
        None,
    )

    if not rsa_key:
        raise exceptions.AuthenticationFailed(
            "Unable to find appropriate signing key."
        )

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=settings.AUTH0_ALGORITHMS,
            audience=settings.AUTH0_API_AUDIENCE,
            issuer=_auth0_issuer(),
        )
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed("Token expired.")
    except jwt.JWTClaimsError:
        raise exceptions.AuthenticationFailed(
            "Incorrect claims. Check audience and issuer."
        )
    except Exception:
        raise exceptions.AuthenticationFailed(
            "Unable to parse authentication token."
        )

    email = payload.get("email")
    auth0_sub = payload.get("sub")
    token_sub = (auth0_sub or "").strip() if isinstance(auth0_sub, str) else ""
    given_name = payload.get("given_name") or ""
    family_name = payload.get("family_name") or ""
    full_name = payload.get("name") or ""
    picture = payload.get("picture") or ""

    userinfo: dict = {}
    userinfo_lookup_failed = False

    # Fast-path auth: do not call /userinfo unless strictly required for login.
    # We only need an email when creating/updating the local account; known users
    # (resolved by stable auth0_sub) can authenticate with stored email.
    existing_user = None
    if auth0_sub:
        existing_user = User.objects.filter(auth0_sub=auth0_sub).first()
        if not email and existing_user and existing_user.email:
            email = existing_user.email

    if not email:
        t0_userinfo = time.perf_counter()
        try:
            userinfo_response = requests.get(
                f"https://{settings.AUTH0_DOMAIN}/userinfo",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            userinfo_response.raise_for_status()
            try:
                userinfo = userinfo_response.json()
            except (json.JSONDecodeError, ValueError):
                userinfo = {}
            if not isinstance(userinfo, dict):
                userinfo = {}
        except requests.RequestException:
            userinfo_lookup_failed = True
            userinfo = {}
        finally:
            userinfo_ms = (time.perf_counter() - t0_userinfo) * 1000
        if userinfo:
            email = email or userinfo.get("email")
            auth0_sub = auth0_sub or userinfo.get("sub")
            if not given_name:
                given_name = userinfo.get("given_name") or ""
            if not family_name:
                family_name = userinfo.get("family_name") or ""
            if not full_name:
                full_name = userinfo.get("name") or ""
            if not picture:
                picture = userinfo.get("picture") or ""

    if not email:
        if userinfo_lookup_failed:
            raise exceptions.AuthenticationFailed(
                "Email not provided by token, and /userinfo lookup failed."
            )
        raise exceptions.AuthenticationFailed("Email not provided by Auth0.")

    email = User.objects.normalize_email(email).lower()
    email = _clip(email, User._meta.get_field("email").max_length)

    fn_max = User._meta.get_field("first_name").max_length
    ln_max = User._meta.get_field("last_name").max_length
    sub_max = User._meta.get_field("auth0_sub").max_length
    given_name = _clip(given_name, fn_max)
    family_name = _clip(family_name, ln_max)
    full_name = _clip(full_name, Profile._meta.get_field("display_name").max_length)
    picture = _clip(picture, Profile._meta.get_field("avatar_url").max_length)
    if auth0_sub:
        auth0_sub = _clip(auth0_sub, sub_max)

    user = None
    if existing_user is not None:
        user = existing_user
    elif auth0_sub:
        user = User.objects.filter(auth0_sub=auth0_sub).first()

    if user is None:
        user = User.objects.filter(email=email).first()

    if user is None:
        try:
            user = User.objects.create_user(email=email, password=None)
        except IntegrityError:
            # Concurrent sync requests can race user creation.
            user = User.objects.filter(email=email).first()
            if user is None:
                raise

    user_changed = False
    if user.email != email:
        user.email = email
        user_changed = True
    if user.first_name != given_name:
        user.first_name = given_name
        user_changed = True
    if user.last_name != family_name:
        user.last_name = family_name
        user_changed = True
    if auth0_sub:
        if user.auth0_sub != auth0_sub:
            user.auth0_sub = auth0_sub
            user_changed = True
    if user_changed:
        t0_save_user = time.perf_counter()
        try:
            user.save()
        except IntegrityError as exc:
            logger.warning("Auth0 user save integrity error for %s", email, exc_info=True)
            raise exceptions.AuthenticationFailed(
                "Could not sync account (identity conflict). Try again or contact support."
            ) from exc
        except OperationalError:
            logger.exception("Auth0 user save database error for %s", email)
            raise
        finally:
            save_user_ms = (time.perf_counter() - t0_save_user) * 1000

    try:
        profile = user.profile
    except Profile.DoesNotExist:
        profile = None
    if profile is not None:
        # Do not clobber profile fields the user may have edited via PATCH;
        # only seed from Auth0/IdP when the field is still empty.
        profile_changed = False
        if full_name and not (profile.display_name or "").strip():
            profile.display_name = full_name
            profile_changed = True
        if picture and not (profile.avatar_url or "").strip():
            profile.avatar_url = picture
            profile_changed = True
        if profile_changed:
            t0_save_profile = time.perf_counter()
            try:
                profile.save()
            except (IntegrityError, OperationalError):
                logger.exception("Auth0 profile save failed for %s", email)
                raise
            finally:
                save_profile_ms = (time.perf_counter() - t0_save_profile) * 1000

    sync_slack_identity_from_auth0_userinfo(user, userinfo)

    auth_payload = {"token": token, "payload": payload}
    if timing_enabled:
        total_ms = (time.perf_counter() - t_auth_start) * 1000
        logger.info(
            "auth0_auth_timing email=%s total_ms=%.2f userinfo_ms=%.2f save_user_ms=%.2f save_profile_ms=%.2f used_userinfo=%s user_changed=%s",
            email,
            total_ms,
            userinfo_ms,
            save_user_ms,
            save_profile_ms,
            bool(userinfo),
            user_changed,
        )
    return (user, auth_payload)


class Auth0TokenAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth:
            return None

        if auth[0].lower() != self.keyword.lower().encode():
            return None

        if len(auth) != 2:
            raise exceptions.AuthenticationFailed("Invalid Authorization header.")

        token = auth[1].decode("utf-8")
        return authenticate_bearer_token(token)
