#!/usr/bin/env bash
set -euo pipefail

# Always run from this repo’s backend, regardless of Appliku/compose cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR/backend"
# Required for admin (and Whitenoise manifest static) when using
# CompressedManifestStaticFilesStorage in production.
python3 manage.py collectstatic --noinput
exec python3 manage.py migrate
