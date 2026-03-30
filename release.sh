#!/usr/bin/env bash
set -euo pipefail

# Always run from this repo’s backend, regardless of Appliku/compose cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR/backend"
exec python3 manage.py migrate