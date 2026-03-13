import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from jose import jwt
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from users.models import Profile

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

        jwks_url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"

        try:
            jwks_response = requests.get(jwks_url, timeout=5)
            jwks_response.raise_for_status()
            jwks = jwks_response.json()
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

        userinfo = {}
        email = payload.get("email")
        auth0_sub = payload.get("sub")

        if not email:
            try:
                userinfo_response = requests.get(
                    f"https://{settings.AUTH0_DOMAIN}/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5,
                )
                userinfo_response.raise_for_status()
                userinfo = userinfo_response.json()
                email = userinfo.get("email")
                auth0_sub = auth0_sub or userinfo.get("sub")
            except requests.RequestException:
                raise exceptions.AuthenticationFailed(
                    "Email not provided by token, and /userinfo lookup failed."
                )

        if not email:
            raise exceptions.AuthenticationFailed("Email not provided by Auth0.")

        given_name = payload.get("given_name") or userinfo.get("given_name") or ""
        family_name = payload.get("family_name") or userinfo.get("family_name") or ""
        full_name = payload.get("name") or userinfo.get("name") or ""
        picture = payload.get("picture") or userinfo.get("picture") or ""

        user = None

        if auth0_sub:
            existing_profile = (
                Profile.objects.select_related("user")
                .filter(auth0_sub=auth0_sub)
                .first()
            )
            if existing_profile:
                user = existing_profile.user

        if user is None:
            user = User.objects.filter(email=email).first()

        if user is None:
            base_username = email.split("@")[0]
            username = base_username
            counter = 1

            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                username=username,
                email=email,
            )

        user.email = email
        user.first_name = given_name
        user.last_name = family_name
        user.save()

        profile = getattr(user, "profile", None)
        if profile:
            if full_name and hasattr(profile, "display_name"):
                profile.display_name = full_name
            if picture and hasattr(profile, "avatar_url"):
                profile.avatar_url = picture
            if auth0_sub and hasattr(profile, "auth0_sub"):
                profile.auth0_sub = auth0_sub
            profile.save()

        return (user, token)
