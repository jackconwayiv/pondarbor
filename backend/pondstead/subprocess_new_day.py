"""Run the TypeScript new-day pipeline via `npx tsx` (repo frontend)."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-server-new-day.mts"
_INITIAL_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-gen-initial.mts"
_FILTER_SCRIPT = _REPO_ROOT / "frontend" / "scripts" / "pondstead-filter-world.mts"


@dataclass
class _RunResult:
    returncode: int
    stdout: str
    stderr: str


def _run_npx_tsx(
    args: list[str],
    *,
    stdin: str | None = None,
    timeout: int,
) -> _RunResult:
    """Run `npx tsx <args>` from the frontend dir, never raising for launch failures.

    Treats FileNotFoundError (e.g. `npx` not on PATH for the Django process) and other
    OSError-class failures as a non-zero returncode so callers can fall back gracefully
    instead of bubbling a 500 to the client.
    """
    cmd = ["npx", "tsx", *args]
    try:
        proc = subprocess.run(
            cmd,
            input=stdin,
            text=True,
            capture_output=True,
            cwd=str(_REPO_ROOT / "frontend"),
            timeout=timeout,
            check=False,
        )
        return _RunResult(proc.returncode, proc.stdout or "", proc.stderr or "")
    except FileNotFoundError as exc:
        return _RunResult(127, "", f"`npx` not found on PATH: {exc}")
    except subprocess.TimeoutExpired as exc:
        return _RunResult(124, "", f"timeout after {timeout}s: {exc}")
    except OSError as exc:
        return _RunResult(126, "", f"failed to launch npx tsx: {exc}")


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
    proc = _run_npx_tsx([str(_SCRIPT)], stdin=json.dumps(payload), timeout=120)
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
    proc = _run_npx_tsx([str(_INITIAL_SCRIPT), str(pc)], timeout=120)
    if proc.returncode != 0:
        return load_initial_world_envelope_legacy()
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return load_initial_world_envelope_legacy()


def filter_world_snapshot_for_viewer(snapshot: dict[str, Any], viewer_seat: int) -> dict[str, Any]:
    proc = _run_npx_tsx(
        [str(_FILTER_SCRIPT)],
        stdin=json.dumps({"world": snapshot, "viewerSeat": viewer_seat}),
        timeout=60,
    )
    if proc.returncode != 0:
        # Fail closed: do not leak enemy intel if the TS filter subprocess fails.
        # Conservatively hide all enemy stacks and scrub all enemy buildings unless the tile is revealed.
        try:
            seat_key = str(int(viewer_seat))
        except Exception:
            seat_key = "0"
        revealed = set()
        try:
            r = (snapshot.get("revealedBySeat") or {}).get(seat_key) or []
            if isinstance(r, list):
                revealed = set(str(x) for x in r)
        except Exception:
            revealed = set()

        def _scrub_cell(cell: dict[str, Any], key: str) -> dict[str, Any]:
            # Remove building + construction details for enemy-owned sites unless visible (we don't have LOS here),
            # and if unrevealed, also blank terrain/resource.
            out = dict(cell)
            if key in revealed:
                out["building"] = "none"
                out.pop("buildingOwnerId", None)
                out.pop("buildingCondition", None)
                out.pop("constructionTarget", None)
                out.pop("constructionOwnerId", None)
                out.pop("constructionBorrowedUnitKind", None)
                out.pop("constructionNightsLeft", None)
                return out
            out["symbol"] = "G"
            out["ground"] = "grass"
            out["resource"] = "none"
            out["building"] = "none"
            out.pop("buildingOwnerId", None)
            out.pop("buildingCondition", None)
            out.pop("constructionTarget", None)
            out.pop("constructionOwnerId", None)
            out.pop("constructionBorrowedUnitKind", None)
            out.pop("constructionNightsLeft", None)
            return out

        v = int(viewer_seat)
        stacks = []
        for st in snapshot.get("stacks") or []:
            if not isinstance(st, dict):
                continue
            if int(st.get("ownerId") or 0) == v:
                stacks.append(st)

        m = snapshot.get("map") if isinstance(snapshot.get("map"), dict) else None
        if m and isinstance(m.get("cells"), list):
            cells2 = []
            for r, row in enumerate(m.get("cells") or []):
                if not isinstance(row, list):
                    cells2.append(row)
                    continue
                row2 = []
                for c, cell in enumerate(row):
                    if not isinstance(cell, dict):
                        row2.append(cell)
                        continue
                    key = f"{r}-{c}"
                    # If an enemy building/construction exists here, scrub it.
                    owner_b = cell.get("buildingOwnerId")
                    owner_c = cell.get("constructionOwnerId")
                    is_enemy = (owner_b is not None and int(owner_b) != v) or (
                        owner_c is not None and int(owner_c) != v
                    )
                    row2.append(_scrub_cell(cell, key) if is_enemy else cell)
                cells2.append(row2)
            m2 = dict(m)
            m2["cells"] = cells2
        else:
            m2 = m or snapshot.get("map")

        out = dict(snapshot)
        out["stacks"] = stacks
        out["map"] = m2
        out["viewer_filter_failed"] = True
        return out
    return json.loads(proc.stdout)
