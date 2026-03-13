#!/usr/bin/env bash
set -euo pipefail

cd /app/backend
python manage.py migrate
python manage.py collectstatic --noinput