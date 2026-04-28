/**
 * Prints JSON envelope for Django to seed a new 2P campaign (stdout).
 * Run from repo root: cd frontend && npx tsx scripts/pondstead-dump-initial-world.mts
 */
import { serializeWorldForServer } from "../src/pondstead/pondsteadServerSync";
import { createFreshTwoPlayerPondsteadState } from "../src/pondstead/pondsteadWorldLayout";

const f = createFreshTwoPlayerPondsteadState();
const world = serializeWorldForServer({
  map: f.map,
  stacks: f.stacks,
  recruitQueues: {},
  pursesBySeat: f.pursesBySeat,
  bonusPointsBySeat: { 0: 0, 1: 0 },
  revealedBySeat: f.revealedBySeat,
  scoutedTodayBySeat: { 0: new Set(), 1: new Set() },
  stackMovementBySeat: { 0: {}, 1: {} },
  recruitUsedThisDay: new Set(),
  day: 1,
});
const envelope = { world, undoStacksBySeat: { "0": [], "1": [] } };
process.stdout.write(JSON.stringify(envelope));
