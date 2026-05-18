#!/usr/bin/env bash
# Verify Vite manifest + Django collectstatic after a production frontend build.
# Run from repo root: bash scripts/spa-static-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
MANIFEST="$ROOT/frontend/dist/.vite/manifest.json"

cd "$ROOT/frontend"
# npm 11+ warns on Cursor's npm_config_devdir (node-gyp path, not an npm config key).
unset npm_config_devdir
npm ci
npm run build

test -f "$MANIFEST" || {
  echo "missing $MANIFEST" >&2
  exit 1
}

python3 - <<'PY' "$MANIFEST"
import json
import sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    m = json.load(f)
assert "index.html" in m, "manifest must contain index.html entry"
assert m["index.html"].get("file"), "index.html entry must list hashed file"
PY

cd "$ROOT/backend"
if ! python3 -c "import django" 2>/dev/null; then
  echo "spa-static-smoke: Django not found. Install backend deps: pip install -r backend/requirements.txt" >&2
  exit 1
fi
export SECRET_KEY="${SECRET_KEY:-spa-static-smoke-not-secret}"
export DEBUG="${DEBUG:-True}"
python3 manage.py collectstatic --noinput

echo "spa-static-smoke: OK"
