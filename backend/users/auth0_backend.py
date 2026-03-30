import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from jose import jwt
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from common.jwks import get_auth0_jwks

User = get_user_model()


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
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                for key in jwks.get("keys", [])
                if key.get("kid") == unverified_header.get("kid")
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
                issuer=f"https://{settings.AUTH0_DOMAIN}/",
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
        given_name = payload.get("given_name") or ""
        family_name = payload.get("family_name") or ""
        full_name = payload.get("name") or ""
        picture = payload.get("picture") or ""

        userinfo: dict = {}
        need_email = not email
        # Access tokens for a custom API audience typically omit OIDC profile claims
        # (picture, name). ID token and /userinfo include them for Google etc.
        need_profile = not picture or not (full_name or given_name or family_name)

        if need_email or need_profile:
            try:
                userinfo_response = requests.get(
                    f"https://{settings.AUTH0_DOMAIN}/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5,
                )
                userinfo_response.raise_for_status()
                userinfo = userinfo_response.json()
            except requests.RequestException:
                if need_email:
                    raise exceptions.AuthenticationFailed(
                        "Email not provided by token, and /userinfo lookup failed."
                    )
                userinfo = {}

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
            raise exceptions.AuthenticationFailed("Email not provided by Auth0.")

        email = User.objects.normalize_email(email).lower()

        user = None
        if auth0_sub:
            user = User.objects.filter(auth0_sub=auth0_sub).first()

        if user is None:
            user = User.objects.filter(email=email).first()

        if user is None:
            user = User.objects.create_user(email=email, password=None)

        user.email = email
        user.first_name = given_name
        user.last_name = family_name
        if auth0_sub:
            user.auth0_sub = auth0_sub
        user.save()

        profile = getattr(user, "profile", None)
        if profile:
            # Do not clobber profile fields the user may have edited via PATCH;
            # only seed from Auth0/IdP when the field is still empty.
            if full_name and not (profile.display_name or "").strip():
                profile.display_name = full_name
            if picture and not (profile.avatar_url or "").strip():
                profile.avatar_url = picture
            profile.save()

        auth_payload = {"token": token, "payload": payload}
        return (user, auth_payload)
