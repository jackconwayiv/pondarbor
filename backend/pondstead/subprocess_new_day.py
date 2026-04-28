"""Run the TypeScript new-day pipeline via `npx tsx` (repo frontend)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-server-new-day.mts"
_INITIAL_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-gen-initial.mts"
_FILTER_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-filter-world.mts"


def run_pondstead_new_day_subprocess(
    *,
    sync_world: dict[str, Any],
    current_day: int,
    player_names_by_seat: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    sync_world: inner `world` dict (map, stacks, recruitQueues, pursesBySeat as string keys, etc.)
    Returns parsed JSON from the script (map, stacks, …, dailyReportsBySeat).
    """
    payload: dict[str, Any] = {
        "sync": sync_world,
        "currentDay": current_day,
    }
    if player_names_by_seat:
        payload["playerNamesBySeat"] = player_names_by_seat
    proc = subprocess.run(
        ["npx", "tsx", str(_SCRIPT)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(_REPO_ROOT / "frontend"),
        timeout=120,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"pondstead new-day script failed ({proc.returncode}): {proc.stderr[:2000]!r}"
        )
    return json.loads(proc.stdout)


def load_initial_world_envelope_legacy() -> dict[str, Any]:
    path = Path(__file__).resolve().parent / "data" / "initial_world_envelope.json"
    with path.open(encoding="utf8") as f:
        return json.load(f)


def load_initial_world_envelope(player_count: int = 2) -> dict[str, Any]:
    """Stitched N-seat map envelope via the same TS layout as the client."""
    pc = max(2, min(6, int(player_count)))
    proc = subprocess.run(
        ["npx", "tsx", str(_INITIAL_SCRIPT), str(pc)],
        text=True,
        capture_output=True,
        cwd=str(_REPO_ROOT / "frontend"),
        timeout=120,
        check=False,
    )
    if proc.returncode != 0:
        return load_initial_world_envelope_legacy()
    return json.loads(proc.stdout)


def filter_world_snapshot_for_viewer(snapshot: dict[str, Any], viewer_seat: int) -> dict[str, Any]:
    proc = subprocess.run(
        ["npx", "tsx", str(_FILTER_SCRIPT)],
        input=json.dumps({"world": snapshot, "viewerSeat": viewer_seat}),
        text=True,
        capture_output=True,
        cwd=str(_REPO_ROOT / "frontend"),
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        return snapshot
    return json.loads(proc.stdout)
