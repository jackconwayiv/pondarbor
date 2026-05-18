#!/usr/bin/env bash
# Run on the Appliku server (SSH or Run Command) to inspect RAM/disk usage.
set -euo pipefail

echo "=== Containers ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

echo ""
echo "=== Container memory (snapshot) ==="
docker stats --no-stream 2>/dev/null || true

echo ""
echo "=== Docker disk ==="
du -sh /var/lib/docker 2>/dev/null || echo "(no access to /var/lib/docker)"

echo ""
echo "=== App tree (if /app or /code exists) ==="
for root in /app /code; do
  if [[ -d "$root" ]]; then
    echo "-- $root --"
    du -sh "$root/frontend/node_modules" "$root/frontend/dist" "$root/backend/staticfiles" 2>/dev/null || true
  fi
done

echo ""
echo "=== Prune candidates (dry-run counts) ==="
docker image ls -f dangling=true -q 2>/dev/null | wc -l | xargs -I{} echo "dangling images: {}"
echo "To reclaim disk: docker image prune -f && docker builder prune -f"
