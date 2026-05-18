#!/usr/bin/env bash
set -euo pipefail

# Appliku one-off release containers may not inherit app env vars; load exports
# written at deploy time (same pattern as the image BUILD_COMMAND).
if [[ -f /env/envs_export.sh ]]; then
  set -a
  # shellcheck disable=SC1091
  source /env/envs_export.sh
  set +a
elif [[ -f /env/dot.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /env/dot.env
  set +a
fi

# Always run from this repo’s backend, regardless of Appliku/compose cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR/backend"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set for the release process." >&2
  echo "Configure the same Postgres DATABASE_URL on Appliku for both web and release." >&2
  exit 1
fi

# Required for admin (and Whitenoise manifest static) when using
# CompressedManifestStaticFilesStorage in production.
python3 manage.py collectstatic --noinput
exec python3 manage.py migrate
