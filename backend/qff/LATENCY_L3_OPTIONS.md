# QFF command latency — Level 3 architectural options

Level 1–2 tuning (`qff_command_timing`, handler vs `request_timing` query delta,
session slimming, optional combat-room caps) targets sub-second *typical* POST
`/qff/command/` latency. If those measures plateau above the product SLO under
real concurrent load, consider the following **behaviorally heavier** options.

## Two-phase command response

**Idea:** Return quickly with **messages + minimal structured deltas** (room id,
action_log slice, combat flags). Push a **full session** or map delta over the
existing QFF WebSocket channel after `run_lazy_simulation` completes.

**Pros:** Player sees acknowledgment fast; expensive `build_session_for_character`
can move off the critical HTML POST path.

**Cons:** Frontend must handle transient inconsistency (messages vs sidebar until
WS patch arrives); contract and error handling grow.

## Background lazy simulation

**Idea:** Run `run_lazy_simulation` from a Celery beat / worker on a short interval;
HTTP command path runs **execute + minimal consistency** only.

**Pros:** Large reduction in per-request DB work when many rooms have due combat.

**Cons:** Highest behavioral risk — reconciling “what the player sees” vs realm
state, duplicate processing guards, and failure modes if the worker falls behind.

## Read replicas and pooling

**Idea:** Route read-heavy session assembly or analytics to replicas; use PgBouncer
(or equivalent) for connection churn.

**Pros:** Low application code churn; helps when `request_timing db_ms` dominates
and Postgres is the bottleneck.

**Cons:** Replica lag must stay below perceptible thresholds for gameplay
fairness; does not shrink CPU spent in Python.

Use Level 3 only after structured logs show **which** bucket (`exec_ms`,
`sim_ms`, `session_ms`, auth/overhead queries) remains unacceptable once Level 1–2
is exhausted.
