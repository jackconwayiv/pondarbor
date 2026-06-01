import {
  SCHEMA_VERSION,
  createDefaultClicker2State,
  normalizeClicker2State,
  normalizeClicker2StateForSchema,
  resolvePondStartedAtMs,
  type Clicker2GameState,
  type Clicker2StateResponse,
} from "./api";
import { repairEnergyAfterPondCycle } from "./pondCycle";

const STORAGE_KEY_PREFIX = "pondarbor.clicker2.v1";

export type Clicker2LocalSave = {
  state: Clicker2GameState;
  schema_version: number;
  savedAtMs: number;
};

export function clicker2LocalSaveKey(userId: number): string {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

export function readClicker2LocalSave(userId: number): Clicker2LocalSave | null {
  try {
    const raw = localStorage.getItem(clicker2LocalSaveKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.state === undefined || typeof o.savedAtMs !== "number") return null;
    return {
      state: normalizeClicker2State(o.state),
      schema_version:
        typeof o.schema_version === "number" && Number.isFinite(o.schema_version)
          ? Math.max(1, Math.floor(o.schema_version))
          : SCHEMA_VERSION,
      savedAtMs: o.savedAtMs,
    };
  } catch {
    return null;
  }
}

export function writeClicker2LocalSave(
  userId: number,
  state: Clicker2GameState,
): void {
  try {
    const payload: Clicker2LocalSave = {
      state,
      schema_version: SCHEMA_VERSION,
      savedAtMs: Date.now(),
    };
    localStorage.setItem(clicker2LocalSaveKey(userId), JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function resolveClicker2LoadState(
  server: Clicker2StateResponse,
  local: Clicker2LocalSave | null,
): Clicker2GameState {
  const serverState = server.state
    ? normalizeClicker2StateForSchema(server.state, server.schema_version)
    : null;
  const localState = local?.state ?? null;

  if (!serverState && localState) return localState;
  if (serverState && !localState) return serverState;
  if (!serverState && !localState) return createDefaultClicker2State();

  const serverMs = server.updated_at ? Date.parse(server.updated_at) : 0;
  const localMs = local!.savedAtMs;

  if (localMs > serverMs) return localState!;
  return serverState!;
}

export function finalizeClicker2LoadState(
  server: Clicker2StateResponse,
  local: Clicker2LocalSave | null,
): Clicker2GameState {
  const merged = resolveClicker2LoadState(server, local);
  const pondStart = resolvePondStartedAtMs(merged, server.created_at);
  return repairEnergyAfterPondCycle({
    ...merged,
    pond_started_at_ms: pondStart,
  });
}
