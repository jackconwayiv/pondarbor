import json

from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import render


def _built_public_asset_url(name: str) -> str:
    try:
        return staticfiles_storage.url(name)
    except ValueError:
        return f"{settings.STATIC_URL.rstrip('/')}/{name.lstrip('/')}"


def redirect_favicon_svg(request):
    return HttpResponseRedirect(_built_public_asset_url("favicon.svg"))


def redirect_pondarbor_logo_png(request):
    return HttpResponseRedirect(_built_public_asset_url("pondarborlogo.png"))


def redirect_icons_svg(request):
    return HttpResponseRedirect(_built_public_asset_url("icons.svg"))


def spa_index(request, route=None):
    manifest_path = (
        settings.BASE_DIR.parent / "frontend" / "dist" / ".vite" / "manifest.json"
    )

    if not manifest_path.exists():
        raise Http404("Frontend build manifest not found.")

    manifest = json.loads(manifest_path.read_text())
    entry = manifest.get("index.html")

    if not entry:
        raise Http404("Vite entrypoint not found in manifest.")

    vite_js = [entry["file"]]
    vite_css = entry.get("css", [])

    response = render(
        request,
        "index.html",
        {
            "vite_js": vite_js,
            "vite_css": vite_css,
            "favicon_href": _built_public_asset_url("favicon.svg"),
            "pondarbor_logo_src": _built_public_asset_url("pondarborlogo.png"),
            "pondarbor_profile_src": _built_public_asset_url(
                "pondarborprofile.png"
            ),
        },
    )
    # Avoid long-lived CDN/browser caching of the HTML shell: after deploy, an old
    # document could still point at removed hashed chunks under /static/. Immutable
    # hashed assets are served by Whitenoise with strong caching separately.
    response["Cache-Control"] = "no-store, max-age=0, must-revalidate"
    return response
