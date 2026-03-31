# PondArbor
Full-stack app using Django/DRF (backend) and React/TypeScript/Chakra UI (frontend).

## Dev
Run locally with Docker Compose: `docker compose up --build`
Frontend: `http://localhost:5173` • Backend: `http://localhost:8000` • Health: `/api/v1/users/health/` (legacy `/users/health/` still mounted)

## Deploy
Appliku deploys this as a **single app**.
Build command: `cd frontend && npm ci && npm run build`
Processes: `web -> bash run.sh` and `release -> bash release.sh`

`release.sh` and `run.sh` resolve paths from the script location so migrations and Gunicorn always use **`backend/`** even when the host cwd differs (e.g. Appliku one-off vs web).

**Check in Appliku**

- **Release** process must stay enabled and run **`bash release.sh`** (or equivalent) on every deploy so `collectstatic` runs (admin static + Whitenoise manifest) and **`manage.py migrate`** runs against production Postgres.
- **`DATABASE_URL`** (and related env) must be the **same** for **`web`** and **`release`**; if they diverge, you can get “migrations applied” in release while `web` hits an empty or different DB.
- **App logs**: production uses `LOGGING` in `backend/config/settings.py` so `500` tracebacks show up in Gunicorn logs.

**Manual migrate (one-off / Run command)**

Use the path that exists inside the deployed image (commonly):

`python3 /code/backend/manage.py migrate`

**`/admin` returns 500** after deploy usually means static files were never collected. Run once (then redeploy so `release.sh` includes `collectstatic` going forward):

`python3 /code/backend/manage.py collectstatic --noinput`

If `migrate` reports nothing to apply but the API errors with **missing tables**, the `django_migrations` rows may not match reality; fix DB history or reset the schema in a safe environment before relying on the app.