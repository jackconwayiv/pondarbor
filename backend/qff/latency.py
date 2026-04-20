"""QFF command latency: definitions and evidence gates (see deployment notes).

**Authoritative effect** — Time until UI reflects server-backed state after submit (HTTP
round-trip + server ``total_ms`` until ``setSession`` applies), e.g. room name and log
from the JSON response.

**Perceived effect** — Time until the player sees immediate feedback (optimistic log,
spinner). Can approach 0 ms without reducing server work.

Use ``command_view`` timings (``exec_ms``, ``sim_ms``, ``session_ms``, ``total_ms``) with
``QFF_COMMAND_TIMING_LOG`` enabled to aggregate p50/p95 before removing features.

Hypothesis gate (tune with real baselines): consider skipping minimap on the hot path
(``QFF_SESSION_MINIMAL_AREA_MAP``) when profiling shows ``session_ms`` is a large share
of server time, e.g. at least ``MINIMAP_OFF_HOT_PATH_SESSION_MS_MIN_PCT`` percent of
``total_ms`` at p95, or ``session_ms`` p95 above ``MINIMAP_OFF_HOT_PATH_SESSION_MS_P95``.

After a change, require a measured improvement (e.g. p95 authoritative latency down by
``LATENCY_CHANGE_ACCEPT_MIN_PCT`` or an absolute ms floor) before keeping UX cuts.
"""

from __future__ import annotations

# Percent of total_ms above which session/minimap work is a plausible primary lever.
MINIMAP_OFF_HOT_PATH_SESSION_MS_MIN_PCT: float = 25.0

# Absolute session_ms p95 (ms) above which minimap skip is worth A/B (set after baseline).
MINIMAP_OFF_HOT_PATH_SESSION_MS_P95: float = 80.0

# Minimum relative improvement to keep a latency PR that removes features (percent).
LATENCY_CHANGE_ACCEPT_MIN_PCT: float = 10.0
