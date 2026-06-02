import type { Goal } from "./types";

/** Prefer the goal snapshot with the latest `updated_at` (avoids stale detail/dashboard fetches). */
export function mergeGoalIfNewer(current: Goal | null, incoming: Goal): Goal {
  if (!current || current.id !== incoming.id) return incoming;
  const curT = Date.parse(current.updated_at);
  const incT = Date.parse(incoming.updated_at);
  if (Number.isNaN(incT)) return incoming;
  if (Number.isNaN(curT)) return incoming;
  return incT >= curT ? incoming : current;
}
