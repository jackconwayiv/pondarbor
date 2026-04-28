"""Run the TypeScript new-day pipeline via `npx tsx` (repo frontend)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-server-new-day.mts"


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


def load_initial_world_envelope() -> dict[str, Any]:
    path = Path(__file__).resolve().parent / "data" / "initial_world_envelope.json"
    with path.open(encoding="utf8") as f:
        return json.load(f)
