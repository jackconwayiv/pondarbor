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

function toNumRecord<T>(o: Record<string, T>): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [k, v] of Object.entries(o)) {
    out[Number(k)] = v;
  }
  return out;
}

function setsFromJson(o: Record<string, string[] | undefined>): Record<number, Set<string>> {
  return {
    0: new Set(o["0"] ?? []),
    1: new Set(o["1"] ?? []),
  };
}

function syncFromJson(raw: JsonSync): PondsteadNewDaySync {
  return {
    map: raw.map,
    stacks: raw.stacks,
    recruitQueues: raw.recruitQueues as PondsteadNewDaySync["recruitQueues"],
    pursesBySeat: toNumRecord(raw.pursesBySeat) as Record<number, ResourcePurse>,
    bonusPointsBySeat: toNumRecord(raw.bonusPointsBySeat) as Record<number, number>,
    revealedBySeat: setsFromJson(raw.revealedBySeat ?? {}),
    scoutedTodayBySeat: setsFromJson(raw.scoutedTodayBySeat ?? {}),
  };
}

function setsToJson(s: Record<number, Set<string>>): Record<string, string[]> {
  return {
    "0": Array.from(s[0] ?? []),
    "1": Array.from(s[1] ?? []),
  };
}

function pursesToJson(p: Record<number, ResourcePurse>): Record<string, ResourcePurse> {
  return { "0": p[0]!, "1": p[1]! };
}

function bonusToJson(b: Record<number, number>): Record<string, number> {
  return { "0": b[0] ?? 0, "1": b[1] ?? 0 };
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
  const playerNamesBySeat =
    names != null
      ? { 0: names["0"] ?? "West", 1: names["1"] ?? "East" }
      : undefined;
  const incomeReportSeat = body.incomeReportSeat ?? 0;
  const out = runPondsteadCommitNewDayPipeline({
    sync,
    currentDay: body.currentDay,
    incomeReportSeat,
    playerName: playerNamesBySeat?.[incomeReportSeat] ?? "Player",
    playerNamesBySeat,
    rng: Math.random,
  });
  const serializable = {
    map: out.map,
    stacks: out.stacks,
    recruitQueues: out.recruitQueues,
    pursesBySeat: pursesToJson(out.pursesBySeat),
    bonusPointsBySeat: bonusToJson(out.bonusPointsBySeat),
    revealedBySeat: setsToJson(out.revealedBySeat),
    scoutedTodayBySeat: { "0": [], "1": [] },
    stackMovementBySeat: { "0": {}, "1": {} },
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
