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

## Calendar sync

The `calendars` app imports Google Calendar feeds via their "Secret address in iCal format" URL (`https://calendar.google.com/calendar/ical/...`). iCal sources are shared by pasting one URL; no OAuth dance is needed, and every approved user sees every other approved user's events in the monthly view.

### How refresh actually happens today

Syncing is pull-based and **lazy-only** in the deployed setup — there's no scheduled job wired up. When a browser hits `GET /api/v1/calendars/events/`, the view opportunistically re-fetches any iCal sources whose `last_synced_at` is older than ~15 minutes (capped at 5 sources per request) before returning the response. Fetches use conditional `If-None-Match` / `If-Modified-Since` so unchanged feeds cost a single 304.

Net effect: calendars are fresh whenever someone is actually looking at them. If nobody visits the page, nothing refreshes — which is fine because there's no one to show the data to.

### Optional: run a scheduled refresh

If you want proactive background sync (e.g., to drive notifications in the future), a `sync_calendars` management command is provided. It's safe to run repeatedly and is a no-op when everything is already fresh.

```
python manage.py sync_calendars
```

Flags:

- `--max-age-minutes N` — only re-sync feeds older than N minutes (defaults to 15).
- `--source-id <id>` — sync a single source (ignores age).
- `--force` — re-sync every active iCal source regardless of age.

How to schedule it depends on where the backend is deployed: a host crontab entry (`*/15 * * * * ... python manage.py sync_calendars`), a platform cron feature (Appliku Cron Jobs, Render Cron Jobs, K8s `CronJob`, etc.), or an external pinger (GitHub Actions `schedule` + a shared-secret HTTP endpoint). None of these are currently set up in this repo.