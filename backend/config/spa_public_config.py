"""Public SPA bootstrap config injected into the Django HTML shell (runtime env, not Vite build)."""

import os

from django.conf import settings


def get_spa_public_config() -> dict[str, str | None]:
    domain = (os.getenv("VITE_AUTH0_DOMAIN") or os.getenv("AUTH0_DOMAIN") or "").strip()
    client_id = (
        os.getenv("VITE_AUTH0_CLIENT_ID") or os.getenv("AUTH0_SPA_CLIENT_ID") or ""
    ).strip()
    audience = (
        os.getenv("VITE_AUTH0_API_AUDIENCE") or os.getenv("AUTH0_API_AUDIENCE") or ""
    ).strip()
    slack = (os.getenv("VITE_AUTH0_SLACK_CONNECTION") or "").strip()
    google_maps_api_key = (os.getenv("VITE_GOOGLE_MAPS_API_KEY") or "").strip()
    google_maps_map_id = (os.getenv("VITE_GOOGLE_MAPS_MAP_ID") or "").strip()
    config: dict[str, str | None] = {
        "auth0Domain": domain,
        "auth0ClientId": client_id,
        "auth0ApiAudience": audience or None,
        "auth0SlackConnection": slack or None,
    }
    if google_maps_api_key:
        config["googleMapsApiKey"] = google_maps_api_key
    if google_maps_map_id:
        config["googleMapsMapId"] = google_maps_map_id

    if not settings.DEBUG:
        sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
        if sentry_dsn:
            config["sentryDsn"] = sentry_dsn
            config["sentryEnvironment"] = (
                os.getenv("SENTRY_ENVIRONMENT", "").strip() or "production"
            )
            config["sentryTracesSampleRate"] = (
                os.getenv("SENTRY_TRACES_SAMPLE_RATE", "").strip() or "0"
            )

    return config
