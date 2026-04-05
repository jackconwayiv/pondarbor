# Quest for Fat (`qff`)

## Production deploy

- Run **`python manage.py migrate`** (or your platform’s equivalent). This applies **schema only**; migrations do not insert game world data.
- **Do not** run `manage.py seed_qff` on production. That command is for local development and optional staging (see below).
- **Do not** use `loaddata` or ad-hoc seed scripts for QFF on production unless you have an explicit, reviewed process.

Routine deploys to an **existing** database **do not re-apply** migrations that have already run; `migrate` is not a source of repeated “reseeding.”

## Local development

After a fresh database and migrations:

```bash
python manage.py seed_qff
```

This creates the default character classes (Nurse, Gym Rat) and the **Village of Ort** demo area. The command refuses to run when `DEBUG` is `False` unless you set `ALLOW_QFF_SEED=1` (e.g. one-off on a staging database).

## World content on production

Create areas, rooms, and exits via the **staff DM world editor** in the app, not via migrations.
