# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Lower peak RAM during deploy builds (npm parallel work + Vite/tsc heap cap).
ENV NODE_OPTIONS=--max-old-space-size=768
ENV npm_config_jobs=2

COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim AS python-deps

ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r /app/backend/requirements.txt


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONOPTIMIZE=1

WORKDIR /app

COPY --from=python-deps /usr/local /usr/local

COPY backend/ /app/backend/
COPY scripts/ /app/scripts/
COPY run.sh /app/run.sh
COPY release.sh /app/release.sh

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Whitenoise serves STATIC_ROOT only. Release collectstatic runs in a separate
# container and does not populate the web image — bake static files at build time.
ENV SECRET_KEY=collectstatic-build-placeholder
ENV DEBUG=false
RUN cd /app/backend && python3 manage.py collectstatic --noinput

RUN chmod +x /app/run.sh /app/release.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import os, sys, urllib.request; port = os.environ.get('PORT', '8000'); url = f'http://127.0.0.1:{port}/api/v1/users/health/'; sys.exit(0 if urllib.request.urlopen(url, timeout=3).getcode() == 200 else 1)"

CMD ["bash", "/app/run.sh"]
