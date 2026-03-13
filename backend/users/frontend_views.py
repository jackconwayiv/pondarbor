import json
from pathlib import Path

from django.conf import settings
from django.http import Http404
from django.shortcuts import render


def spa_index(request):
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

    return render(
        request,
        "index.html",
        {
            "vite_js": vite_js,
            "vite_css": vite_css,
        },
    )
