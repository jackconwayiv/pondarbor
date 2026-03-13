# PondArbor
Full-stack app using Django/DRF (backend) and React/TypeScript/Chakra UI (frontend).

## Dev
Run locally with Docker Compose: `docker compose up --build`
Frontend: `http://localhost:5173` • Backend: `http://localhost:8000` • Health: `/users/health/`

## Deploy
Appliku deploys this as a **single app**.
Build command: `cd frontend && npm ci && npm run build`
Processes: `web -> bash run.sh` and `release -> bash release.sh`