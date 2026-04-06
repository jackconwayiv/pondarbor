#!/usr/bin/env bash
# Local Django with dependencies from backend/.venv (includes boto3 for R2 presign).
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  echo "Missing backend/.venv. Run once:"
  echo "  cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
exec .venv/bin/python manage.py runserver "$@"
