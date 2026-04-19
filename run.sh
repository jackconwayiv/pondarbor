#!/usr/bin/env bash
set -euo pipefail

# Match release.sh: stable path on Appliku (/code/...) and locally.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR/backend"
exec daphne config.asgi:application --bind "0.0.0.0" --port "${PORT:-8000}" -v2