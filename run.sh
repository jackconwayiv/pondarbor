#!/usr/bin/env bash
set -euo pipefail

cd backend
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --log-file -