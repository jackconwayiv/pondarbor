/**
 * argv: [playerCount]
 * stdout: Pondstead envelope JSON { world: PondsteadServerWorldSnapshot, undoStacksBySeat }
 */
import { createFreshPondsteadStateForSeatCount } from "../src/pondstead/pondsteadWorldLayout";
import { serializeWorldForServer } from "../src/pondstead/pondsteadServerSync";

function main() {
  const n = Math.max(2, Math.min(6, parseInt(process.argv[2] ?? "2", 10) || 2));
  const fresh = createFreshPondsteadStateForSeatCount(n);
  const bonusPointsBySeat: Record<number, number> = {};
  for (const k of Object.keys(fresh.pursesBySeat).map(Number)) {
    bonusPointsBySeat[k] = 0;
  }
  const scoutedTodayBySeat: Record<number, Set<string>> = {};
  for (const k of Object.keys(fresh.pursesBySeat).map(Number)) {
    scoutedTodayBySeat[k] = new Set();
  }
  const world = serializeWorldForServer({
    map: fresh.map,
    stacks: fresh.stacks,
    recruitQueues: {},
    pursesBySeat: fresh.pursesBySeat,
    bonusPointsBySeat,
    revealedBySeat: fresh.revealedBySeat,
    scoutedTodayBySeat,
    stackMovementBySeat: Object.fromEntries(Object.keys(fresh.pursesBySeat).map(Number).map((s) => [s, {}])) as Record<
      number,
      Record<string, number>
    >,
    recruitUsedThisDay: new Set(),
    day: 1,
  });
  const undoStacksBySeat: Record<string, unknown[]> = {};
  for (const k of Object.keys(fresh.pursesBySeat).map(Number)) {
    undoStacksBySeat[String(k)] = [];
  }
  process.stdout.write(
    JSON.stringify({
      world,
      undoStacksBySeat,
    }),
  );
}

main();
