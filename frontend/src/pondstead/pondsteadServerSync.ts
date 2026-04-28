import type { PendingRecruits } from "./pondsteadDay";
import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { PondsteadDailyReport } from "./PondsteadDailyReportModal";
import type { ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";

export type PondsteadServerWorldSnapshot = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  pursesBySeat: Record<string, ResourcePurse>;
  bonusPointsBySeat: Record<string, number>;
  revealedBySeat: Record<string, string[]>;
  scoutedTodayBySeat: Record<string, string[]>;
  /** Optional; used so server undo / sync restores march budgets and recruit slots. */
  stackMovementBySeat?: Record<string, Record<string, number>>;
  recruitUsedThisDayKeys?: string[];
  day?: number;
};

function apiBase(): string | undefined {
  const raw = import.meta.env.VITE_PONDSTEAD_API_BASE as string | undefined;
  return raw?.replace(/\/$/, "");
}

function envGameId(): string | undefined {
  const id = import.meta.env.VITE_PONDSTEAD_GAME_ID as string | undefined;
  return id?.trim() || undefined;
}

/** Sync when API base is set and a game id comes from the play route or `VITE_PONDSTEAD_GAME_ID`. */
export function pondsteadServerSyncEnabled(campaignIdFromRoute?: string | null): boolean {
  const gid = (campaignIdFromRoute && campaignIdFromRoute.trim()) || envGameId();
  return Boolean(apiBase() && gid);
}

function resolvedGameId(campaignIdFromRoute?: string | null): string | undefined {
  return (campaignIdFromRoute && campaignIdFromRoute.trim()) || envGameId();
}

export function serializeWorldForServer(args: {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  pursesBySeat: Record<number, ResourcePurse>;
  bonusPointsBySeat: Record<number, number>;
  revealedBySeat: Record<number, Set<string>>;
  scoutedTodayBySeat: Record<number, Set<string>>;
  stackMovementBySeat?: Record<number, Record<string, number>>;
  recruitUsedThisDay?: ReadonlySet<string>;
  day?: number;
}): PondsteadServerWorldSnapshot {
  const purseKeys = (o: Record<number, ResourcePurse>): Record<string, ResourcePurse> => ({
    "0": o[0]!,
    "1": o[1]!,
  });
  const numKeys = (o: Record<number, number>): Record<string, number> => ({
    "0": o[0] ?? 0,
    "1": o[1] ?? 0,
  });
  const setKeys = (o: Record<number, Set<string>>): Record<string, string[]> => ({
    "0": Array.from(o[0] ?? []),
    "1": Array.from(o[1] ?? []),
  });
  const movementKeys = (o: Record<number, Record<string, number>> | undefined): Record<string, Record<string, number>> => ({
    "0": { ...(o?.[0] ?? {}) },
    "1": { ...(o?.[1] ?? {}) },
  });
  const out: PondsteadServerWorldSnapshot = {
    map: args.map,
    stacks: args.stacks,
    recruitQueues: args.recruitQueues,
    pursesBySeat: purseKeys(args.pursesBySeat),
    bonusPointsBySeat: numKeys(args.bonusPointsBySeat),
    revealedBySeat: setKeys(args.revealedBySeat),
    scoutedTodayBySeat: setKeys(args.scoutedTodayBySeat),
  };
  if (args.stackMovementBySeat) {
    out.stackMovementBySeat = movementKeys(args.stackMovementBySeat);
  }
  if (args.recruitUsedThisDay) {
    out.recruitUsedThisDayKeys = Array.from(args.recruitUsedThisDay);
  }
  if (args.day != null) {
    out.day = args.day;
  }
  return out;
}

export async function persistPondsteadEndDay(args: {
  accessToken: string;
  world: PondsteadServerWorldSnapshot;
  expectedRevision: number;
  nextDay: number;
  dailyReport: PondsteadDailyReport;
  undoStacksBySeat?: Record<string, unknown[]>;
  campaignId?: string | null;
}): Promise<number | undefined> {
  const base = apiBase();
  const gid = resolvedGameId(args.campaignId);
  if (!base || !gid) return undefined;
  const url = `${base}/api/v1/pondstead/games/${encodeURIComponent(gid)}/actions/end-day/`;
  const undo = args.undoStacksBySeat ?? { "0": [], "1": [] };
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expected_revision: args.expectedRevision,
      world_json: args.world,
      undo_stacks_by_seat: undo,
      next_day: args.nextDay,
      log_json: {
        dailyReport: args.dailyReport,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pondstead sync failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as { revision?: number };
  return typeof j.revision === "number" ? j.revision : undefined;
}

export async function persistPondsteadPatchWorld(args: {
  accessToken: string;
  world: PondsteadServerWorldSnapshot;
  undoStacksBySeat: Record<string, unknown[]>;
  expectedRevision: number;
  campaignId?: string | null;
}): Promise<number | undefined> {
  const base = apiBase();
  const gid = resolvedGameId(args.campaignId);
  if (!base || !gid) return undefined;
  const url = `${base}/api/v1/pondstead/games/${encodeURIComponent(gid)}/actions/patch-world/`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expected_revision: args.expectedRevision,
      world: args.world,
      undo_stacks_by_seat: args.undoStacksBySeat,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pondstead patch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as { revision?: number };
  return typeof j.revision === "number" ? j.revision : undefined;
}

export async function persistPondsteadServerUndo(args: {
  accessToken: string;
  expectedRevision: number;
  campaignId?: string | null;
}): Promise<{
  revision: number;
  world: PondsteadServerWorldSnapshot;
  undo_stacks_by_seat: Record<string, unknown[]>;
  current_day: number;
} | null> {
  const base = apiBase();
  const gid = resolvedGameId(args.campaignId);
  if (!base || !gid) return null;
  const url = `${base}/api/v1/pondstead/games/${encodeURIComponent(gid)}/actions/undo/`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expected_revision: args.expectedRevision }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pondstead undo failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as {
    revision: number;
    world: PondsteadServerWorldSnapshot;
    undo_stacks_by_seat: Record<string, unknown[]>;
    current_day: number;
  };
}
