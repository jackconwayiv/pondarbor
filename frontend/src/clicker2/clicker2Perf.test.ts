import { describe, expect, it } from "vitest";

import { DENIZENS } from "./denizens";
import { partitionTimelineByDenizen } from "./pondDepthChartModel";
import { simulateGame } from "./simulation";

/** Roughly one visible-tab second at 60 FPS. */
const GAME_LOOP_TICKS_PER_SECOND = 60;
/** CI-safe ceiling; browser paint/React dominate real frame time. */
const GAME_LOOP_BUDGET_MS = 250;

/** Worst-case depth chart partition (capped timeline). */
const TIMELINE_PARTITION_BUDGET_MS = 50;

function maxedLateGameOwned(): {
  ownedDenizens: Record<string, number>;
  ownedSpecialties: Record<number, boolean>;
  denizenMutationLevels: Record<string, number>;
} {
  const ownedDenizens: Record<string, number> = {};
  const denizenMutationLevels: Record<string, number> = {};
  for (const def of DENIZENS) {
    ownedDenizens[def.id] = def.maxOwned;
    denizenMutationLevels[def.id] = 10;
  }
  const ownedSpecialties: Record<number, boolean> = {};
  for (let id = 1; id <= 150; id++) {
    ownedSpecialties[id] = true;
  }
  return { ownedDenizens, ownedSpecialties, denizenMutationLevels };
}

describe("clicker2 perf sanity", () => {
  it("simulateGame stays within budget for ~1s of game-loop ticks at late-game scale", () => {
    const { ownedDenizens, ownedSpecialties, denizenMutationLevels } =
      maxedLateGameOwned();
    const start = performance.now();
    for (let i = 0; i < GAME_LOOP_TICKS_PER_SECOND; i++) {
      simulateGame(
        ownedDenizens,
        ownedSpecialties,
        denizenMutationLevels,
        100,
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(GAME_LOOP_BUDGET_MS);
  });

  it("partitionTimelineByDenizen stays within budget for a full timeline", () => {
    const timeline = Array.from({ length: 2000 }, (_, i) =>
      i % 2 === 0 ? "🌊" : "🪨",
    );
    const start = performance.now();
    partitionTimelineByDenizen(timeline);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(TIMELINE_PARTITION_BUDGET_MS);
  });
});
