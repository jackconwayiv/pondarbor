FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim AS python-deps

ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=python-deps /usr/local /usr/local

COPY backend/ /app/backend/
COPY run.sh /app/run.sh
COPY release.sh /app/release.sh

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN chmod +x /app/run.sh /app/release.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os, sys, urllib.request; port = os.environ.get('PORT', '8000'); url = f'http://127.0.0.1:{port}/api/v1/users/health/'; sys.exit(0 if urllib.request.urlopen(url, timeout=3).getcode() == 200 else 1)"

CMD ["bash", "/app/run.sh"]
