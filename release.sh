#!/usr/bin/env bash
set -euo pipefail

# Appliku one-off release containers may not inherit app env vars; load exports
# written at deploy time (same pattern as the image BUILD_COMMAND).
if [[ -f /env/envs_export.sh ]]; then
  set -a
  # shellcheck disable=SC1091
  source /env/envs_export.sh
  set +a
fi
if [[ -f /env/dot.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /env/dot.env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-${DATABASE_PRIVATE_URL:-}}"

# Always run from this repo’s backend, regardless of Appliku/compose cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR/backend"

if [[ -z "${DATABASE_URL}" ]]; then
  echo "ERROR: DATABASE_URL is not set for the release process." >&2
  echo "Configure Postgres on Appliku for both web and release (see README Deploy)." >&2
  echo "Diagnostics (values not printed):" >&2
  echo "  DATABASE_URL: unset" >&2
  if [[ -n "${DATABASE_PRIVATE_URL:-}" ]]; then
    echo "  DATABASE_PRIVATE_URL: set" >&2
  else
    echo "  DATABASE_PRIVATE_URL: unset" >&2
  fi
  if [[ -f /env/envs_export.sh ]]; then
    echo "  /env/envs_export.sh: present" >&2
  else
    echo "  /env/envs_export.sh: missing" >&2
  fi
  if [[ -f /env/dot.env ]]; then
    echo "  /env/dot.env: present" >&2
  else
    echo "  /env/dot.env: missing" >&2
  fi
  exit 1
fi

# Required for admin (and Whitenoise manifest static) when using
# CompressedManifestStaticFilesStorage in production.
python3 manage.py collectstatic --noinput
exec python3 manage.py migrate
