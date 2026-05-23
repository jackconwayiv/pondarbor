import { describe, expect, it } from "vitest";

import {
  applyMutation,
  bootstrapMutagenPipelineOnLoad,
  collectMutagen,
  ensureMutagenPipelineStarted,
  getMutationLevel,
  isDenizenMutable,
  isMutagenCollectible,
  isMutagenSystemUnlocked,
  MUTAGEN_FORMATION_MS,
  MUTAGEN_MAX_LEVEL,
  MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
  mutagenCostForNextLevel,
  msUntilMutagenCollectible,
  totalMutagensSpentForLevel,
} from "./mutagens";
import { createDefaultClicker2State } from "./api";

describe("mutagens", () => {
  it("unlocks at 1B all-time energy", () => {
    expect(isMutagenSystemUnlocked(MUTAGEN_UNLOCK_ALL_TIME_ENERGY - 1)).toBe(
      false,
    );
    expect(isMutagenSystemUnlocked(MUTAGEN_UNLOCK_ALL_TIME_ENERGY)).toBe(true);
  });

  it("uses 20-hour formation window", () => {
    expect(MUTAGEN_FORMATION_MS).toBe(20 * 60 * 60 * 1000);
    const started = 1_000_000;
    const collectibleAt = started + MUTAGEN_FORMATION_MS;
    expect(isMutagenCollectible(started, collectibleAt - 1)).toBe(false);
    expect(isMutagenCollectible(started, collectibleAt)).toBe(true);
    expect(msUntilMutagenCollectible(started, started)).toBe(
      MUTAGEN_FORMATION_MS,
    );
  });

  it("starts pipeline when unlocked and collects into bank", () => {
    const now = 100_000_000_000;
    const slice = {
      statistics: {
        ...createDefaultClicker2State().statistics,
        all_time_energy_earned: MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
      },
      mutagens_bank: 2,
      mutagen_forming_started_at_ms: 0,
    };
    const started = ensureMutagenPipelineStarted(slice, now);
    expect(started.mutagen_forming_started_at_ms).toBe(now);

    const collected = collectMutagen(
      {
        ...started,
        mutagen_forming_started_at_ms: now - MUTAGEN_FORMATION_MS,
      },
      now,
    );
    expect(collected).not.toBeNull();
    expect(collected!.mutagens_bank).toBe(3);
    expect(collected!.mutagen_forming_started_at_ms).toBe(now);
  });

  it("tiered mutate costs sum to n(n+1)/2", () => {
    expect(mutagenCostForNextLevel(0)).toBe(1);
    expect(mutagenCostForNextLevel(3)).toBe(4);
    expect(totalMutagensSpentForLevel(4)).toBe(10);
    expect(mutagenCostForNextLevel(MUTAGEN_MAX_LEVEL)).toBe(0);
  });

  it("mutates fungi+ owned denizens only", () => {
    expect(isDenizenMutable("algae")).toBe(false);
    expect(isDenizenMutable("fungi")).toBe(true);
    expect(isDenizenMutable("microbes")).toBe(true);

    const result = applyMutation(
      { mutagens_bank: 10, denizen_mutation_levels: {} },
      "fungi",
      3,
    );
    expect(result).not.toBeNull();
    expect(result!.mutagens_bank).toBe(9);
    expect(getMutationLevel(result!.denizen_mutation_levels, "fungi")).toBe(1);

    expect(
      applyMutation(
        { mutagens_bank: 0, denizen_mutation_levels: {} },
        "algae",
        5,
      ),
    ).toBeNull();
  });

  it("bootstrap starts formation on load when already unlocked", () => {
    const state = {
      ...createDefaultClicker2State(),
      statistics: {
        ...createDefaultClicker2State().statistics,
        all_time_energy_earned: MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
      },
      mutagen_forming_started_at_ms: 0,
    };
    const boot = bootstrapMutagenPipelineOnLoad(state, 99_000);
    expect(boot.mutagen_forming_started_at_ms).toBe(99_000);
  });
});
