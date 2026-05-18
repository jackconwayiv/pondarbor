"""Public SPA bootstrap config injected into the Django HTML shell (runtime env, not Vite build)."""

import os


def get_spa_public_config() -> dict[str, str | None]:
    domain = (os.getenv("VITE_AUTH0_DOMAIN") or os.getenv("AUTH0_DOMAIN") or "").strip()
    client_id = (
        os.getenv("VITE_AUTH0_CLIENT_ID") or os.getenv("AUTH0_SPA_CLIENT_ID") or ""
    ).strip()
    audience = (
        os.getenv("VITE_AUTH0_API_AUDIENCE") or os.getenv("AUTH0_API_AUDIENCE") or ""
    ).strip()
    slack = (os.getenv("VITE_AUTH0_SLACK_CONNECTION") or "").strip()
    return {
        "auth0Domain": domain,
        "auth0ClientId": client_id,
        "auth0ApiAudience": audience or None,
        "auth0SlackConnection": slack or None,
    }
