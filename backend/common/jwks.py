import requests
from django.conf import settings
from django.core.cache import cache

JWKS_CACHE_KEY = "auth0:jwks"
JWKS_CACHE_TTL = 3600


def fetch_auth0_jwks():
    url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()


def get_auth0_jwks():
    data = cache.get(JWKS_CACHE_KEY)
    if data is not None:
        return data
    data = fetch_auth0_jwks()
    cache.set(JWKS_CACHE_KEY, data, JWKS_CACHE_TTL)
    return data


def clear_jwks_cache_for_tests():
    cache.delete(JWKS_CACHE_KEY)
