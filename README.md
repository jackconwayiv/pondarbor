# PondArbor
Full-stack app using Django/DRF (backend) and React/TypeScript/Chakra UI (frontend).

## Dev
Run locally with Docker Compose: `docker compose up --build`
Frontend: `http://localhost:5173` • Backend: `http://localhost:8000` • Health: `/api/v1/users/health/` (legacy `/users/health/` still mounted)

## Deploy
Appliku deploys this as a **single app** using the root **`Dockerfile`** (multi-stage: builds frontend, installs Python deps, runs Daphne).

Repo config: [`appliku.yml`](appliku.yml) — import via App → **YAML Config** (must be committed and pushed; does not provision Postgres/Redis — keep existing addon URLs in Environment Variables).

Processes: **`web` → `bash run.sh`** (Daphne ASGI) and **`release` → `bash release.sh`**.

Do **not** set a separate Appliku **build command** for `npm ci` / `npm run build`; the Dockerfile already builds the frontend. A duplicate build wastes RAM during deploy and can leave stray `frontend/node_modules` on disk.

`release.sh` and `run.sh` resolve paths from the script location so migrations and the web process always use **`backend/`** even when the host cwd differs (e.g. Appliku one-off vs web).

**Check in Appliku**

- **Build** → `build_image`: **`dockerfile`**, `dockerfile_path`: **`Dockerfile`**, **build command empty** (or removed).
- **Release** process must stay enabled and run **`bash release.sh`** on every deploy so **`manage.py migrate`** runs against production Postgres. SPA/admin static for **Dockerfile** deploys are baked via `collectstatic` in the image build; release `collectstatic` still updates manifest when admin assets change without a full image rebuild.
- **`DATABASE_URL`** (and related env) must be the **same** for **`web`** and **`release`**; if they diverge, you can get “migrations applied” in release while `web` hits an empty or different DB.
- Appliku may expose the internal Postgres URL as **`DATABASE_PRIVATE_URL`** only. Django and `release.sh` accept either name (`DATABASE_URL` wins if both are set). Prefer setting **`DATABASE_URL`** explicitly in Environment Variables (copy the private URL when the DB is on the same server).
- Set **`REDIS_URL`** (Appliku Redis addon or manual) so Django Channels uses Redis instead of an in-memory layer (better for WebSockets under load).
- Set **`DEBUG=false`** in production.
- **App logs**: production uses `LOGGING` in `backend/config/settings.py` so `500` tracebacks show up in the web process logs.

**RAM / disk diagnostics (on the server)**

```bash
bash scripts/appliku-diagnostics.sh
```

If disk is tight after deploys: `docker image prune -f` and `docker builder prune -f` (reclaims old image layers; safe during a maintenance window).

**Release fails with “DATABASE_URL is not set”**

1. Application → **Environment Variables**: confirm **`DATABASE_URL`** or **`DATABASE_PRIVATE_URL`** is present (not empty).
2. Confirm the **release** process command is **`bash release.sh`** (image path: `/code/release.sh`).
3. On a one-off container (**Run Command**), run `env | grep -i database` and confirm at least one URL variable is set.
4. Redeploy after fixing env; release should log Django applying migrations (e.g. `estates`).

**CDN / reverse proxy (SPA)**

- Do **not** put a long TTL on the **HTML document** (`/` and client routes) without a purge on every deploy. The Django HTML shell sets `Cache-Control: no-store, max-age=0, must-revalidate` so browsers and edges pick up fresh boot URLs after deploy.
- **Hashed** JS/CSS under **`/static/`** are intended to be cached aggressively (Whitenoise / immutable filenames). Stale-document + fresh-chunk mismatches are what cause “MIME type” / failed dynamic import errors.
- If your edge overrides `Cache-Control`, align it with the above: short or no cache for HTML, long cache only for fingerprinted static files.

**White screen after deploy (ops)**

1. Try a **hard refresh** once (old tab may still hold pre-deploy HTML in memory).
2. In browser **Network**, open a failing **`.js`** request: if the body is **HTML** (SPA fallback), a chunk URL is wrong or cached HTML still points at removed files—confirm **`release.sh`** ran `collectstatic` and that **`Vite `base``** in production matches **`STATIC_URL`** (`/static/`).
3. Check **Sentry** (if configured) for chunk or render errors.
4. Locally verify builds: install backend deps once (`pip install -r backend/requirements.txt`), then `bash scripts/spa-static-smoke.sh` (frontend build + manifest + `collectstatic`). CI runs the same via `.github/workflows/spa-static-smoke.yml`.

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