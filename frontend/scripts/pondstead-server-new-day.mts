/**
 * stdin: JSON { sync, currentDay, playerNamesBySeat?, incomeReportSeat? }
 * stdout: JSON { map, stacks, recruitQueues, pursesBySeat, bonusPointsBySeat,
 *   revealedBySeat (string[][]), scoutedTodayBySeat (empty), nextDay, dailyReportsBySeat }
 */
import type { PondsteadNewDaySync } from "../src/pondstead/pondsteadCommitNewDayPipeline";
import { runPondsteadCommitNewDayPipeline } from "../src/pondstead/pondsteadCommitNewDayPipeline";
import type { ResourcePurse } from "../src/pondstead/pondsteadBuildingCosts";
import type { ParsedMap } from "../src/pondstead/types";
import type { UnitStack } from "../src/pondstead/pondsteadUnits";

type JsonSync = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: Record<string, unknown>;
  pursesBySeat: Record<string, ResourcePurse>;
  bonusPointsBySeat: Record<string, number>;
  revealedBySeat: Record<string, string[]>;
  scoutedTodayBySeat: Record<string, string[]>;
};

function sortedSeatKeysFromRecord(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b)
    .map(String);
}

function toNumRecord<T>(o: Record<string, T>): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [k, v] of Object.entries(o)) {
    out[Number(k)] = v;
  }
  return out;
}

function setsFromJson(o: Record<string, string[] | undefined>): Record<number, Set<string>> {
  const out: Record<number, Set<string>> = {};
  for (const k of sortedSeatKeysFromRecord(o as Record<string, unknown>)) {
    const n = Number(k);
    out[n] = new Set(o[k] ?? []);
  }
  if (Object.keys(out).length === 0) {
    out[0] = new Set();
    out[1] = new Set();
  }
  return out;
}

function syncFromJson(raw: JsonSync): PondsteadNewDaySync {
  const bonus = raw.bonusPointsBySeat ?? {};
  const bk = sortedSeatKeysFromRecord(bonus as Record<string, unknown>);
  const bonusNum: Record<number, number> = {};
  for (const k of bk) {
    bonusNum[Number(k)] = bonus[k as keyof typeof bonus] ?? 0;
  }
  return {
    map: raw.map,
    stacks: raw.stacks,
    recruitQueues: raw.recruitQueues as PondsteadNewDaySync["recruitQueues"],
    pursesBySeat: toNumRecord(raw.pursesBySeat) as Record<number, ResourcePurse>,
    bonusPointsBySeat: bonusNum,
    revealedBySeat: setsFromJson(raw.revealedBySeat ?? {}),
    scoutedTodayBySeat: setsFromJson(raw.scoutedTodayBySeat ?? {}),
  };
}

function setsToJson(s: Record<number, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(s)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[String(n)] = Array.from(s[n] ?? []);
  }
  return out;
}

function pursesToJson(p: Record<number, ResourcePurse>): Record<string, ResourcePurse> {
  const out: Record<string, ResourcePurse> = {};
  for (const k of Object.keys(p)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[String(n)] = p[n]!;
  }
  return out;
}

function bonusToJson(b: Record<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(b)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[String(n)] = b[n] ?? 0;
  }
  return out;
}

function emptyScouted(keys: number[]): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const s of keys) {
    o[String(s)] = [];
  }
  return o;
}

function emptyMovement(keys: number[]): Record<string, Record<string, unknown>> {
  const o: Record<string, Record<string, unknown>> = {};
  for (const s of keys) {
    o[String(s)] = {};
  }
  return o;
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const ch of process.stdin) {
    chunks.push(ch as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    process.stderr.write("empty stdin\n");
    process.exit(1);
  }
  const body = JSON.parse(text) as {
    sync: JsonSync;
    currentDay: number;
    playerNamesBySeat?: Record<string, string>;
    incomeReportSeat?: number;
  };
  const sync = syncFromJson(body.sync);
  const names = body.playerNamesBySeat;
  let playerNamesBySeat: Record<number, string> | undefined;
  if (names != null) {
    playerNamesBySeat = {};
    for (const [k, v] of Object.entries(names)) {
      playerNamesBySeat[Number(k)] = v as string;
    }
  }
  const incomeReportSeat = body.incomeReportSeat ?? 0;
  const out = runPondsteadCommitNewDayPipeline({
    sync,
    currentDay: body.currentDay,
    incomeReportSeat,
    playerName: playerNamesBySeat?.[incomeReportSeat] ?? `Seat ${incomeReportSeat}`,
    playerNamesBySeat,
    rng: Math.random,
  });
  const seatNums = sortedSeatKeysFromRecord(out.pursesBySeat as Record<string, unknown>).map(Number);
  const serializable = {
    map: out.map,
    stacks: out.stacks,
    recruitQueues: out.recruitQueues,
    pursesBySeat: pursesToJson(out.pursesBySeat),
    bonusPointsBySeat: bonusToJson(out.bonusPointsBySeat),
    revealedBySeat: setsToJson(out.revealedBySeat),
    scoutedTodayBySeat: emptyScouted(seatNums.length ? seatNums : [0, 1]),
    stackMovementBySeat: emptyMovement(seatNums.length ? seatNums : [0, 1]),
    recruitUsedThisDayKeys: [],
    day: out.nextDay,
    nextDay: out.nextDay,
    dailyReportsBySeat: out.dailyReportsBySeat,
    dailyReport: out.dailyReport,
  };
  process.stdout.write(JSON.stringify(serializable));
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
