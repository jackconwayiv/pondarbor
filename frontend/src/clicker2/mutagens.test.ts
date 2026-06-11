import { describe, expect, it } from "vitest";

import {
  applyMutation,
  autoCollectMutagen,
  bootstrapMutagenPipelineOnLoad,
  collectMutagen,
  ensureMutagenPipelineStarted,
  getMutationLevel,
  hasSpentAnyMutagen,
  isDenizenMutable,
  shouldShowDenizenMutationLevel,
  isMutagenCollectible,
  isMutagenSystemUnlocked,
  MUTAGEN_AUTO_COLLECT_GRACE_MS,
  MUTAGEN_FORMATION_MS,
  MUTAGEN_MAX_LEVEL,
  MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
  mutagenCostForNextLevel,
  msUntilMutagenAutoCollect,
  msUntilMutagenCollectible,
  msUntilNextMutagenFormingUiTick,
  mutagenFormingReadoutMessage,
  settleMutagenPipeline,
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

  it("mutates catalog denizens including ripples and sediment", () => {
    expect(isDenizenMutable("algae")).toBe(false);
    expect(isDenizenMutable("ripples")).toBe(true);
    expect(isDenizenMutable("sediment")).toBe(true);
    expect(isDenizenMutable("fungi")).toBe(true);
    expect(isDenizenMutable("microbes")).toBe(true);

    const ripplesResult = applyMutation(
      { mutagens_bank: 10, denizen_mutation_levels: {} },
      "ripples",
      1,
    );
    expect(ripplesResult).not.toBeNull();
    expect(getMutationLevel(ripplesResult!.denizen_mutation_levels, "ripples")).toBe(
      1,
    );

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

  it("formats forming readout for hours and minutes", () => {
    const hour = 60 * 60 * 1000;
    const minute = 60 * 1000;
    expect(mutagenFormingReadoutMessage(20 * hour)).toBe(
      "A new mutation will be ready in 20 hours.",
    );
    expect(mutagenFormingReadoutMessage(1 * hour)).toBe(
      "A new mutation will be ready in 1 hour.",
    );
    expect(mutagenFormingReadoutMessage(61 * minute)).toBe(
      "A new mutation will be ready in 2 hours.",
    );
    expect(mutagenFormingReadoutMessage(59 * minute)).toBe(
      "A new mutation will be ready in 59 minutes.",
    );
    expect(mutagenFormingReadoutMessage(1 * minute)).toBe(
      "A new mutation will be ready in 1 minute.",
    );
    expect(mutagenFormingReadoutMessage(30 * 1000)).toBe(
      "A new mutation will be ready in 1 minute.",
    );
  });

  it("ticks the forming readout when the displayed countdown changes", () => {
    const hour = 60 * 60 * 1000;
    const minute = 60 * 1000;
    expect(msUntilNextMutagenFormingUiTick(20 * hour)).toBe(hour);
    expect(msUntilNextMutagenFormingUiTick(3 * hour)).toBe(hour);
    expect(msUntilNextMutagenFormingUiTick(90 * 1000)).toBe(30 * 1000);
    expect(msUntilNextMutagenFormingUiTick(1 * minute)).toBe(minute);
  });

  it("detects when any mutagen has been spent", () => {
    expect(hasSpentAnyMutagen({})).toBe(false);
    expect(hasSpentAnyMutagen({ fungi: 1 })).toBe(true);
  });

  it("shows mutation level on mutable owned denizens after first spend", () => {
    const levels = { fungi: 1 };
    expect(
      shouldShowDenizenMutationLevel("ripples", 1, levels, true),
    ).toBe(true);
    expect(
      shouldShowDenizenMutationLevel("fungi", 2, levels, true),
    ).toBe(true);
    expect(
      shouldShowDenizenMutationLevel("microbes", 3, levels, true),
    ).toBe(true);
    expect(
      shouldShowDenizenMutationLevel("microbes", 3, {}, true),
    ).toBe(false);
    expect(
      shouldShowDenizenMutationLevel("fungi", 0, levels, true),
    ).toBe(false);
    expect(shouldShowDenizenMutationLevel("fungi", 2, levels, false)).toBe(
      false,
    );
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
    expect(boot.completedCount).toBe(0);
  });

  function unlockedSlice(startedAt: number, bank = 0, acquired = 0) {
    return {
      statistics: {
        ...createDefaultClicker2State().statistics,
        all_time_energy_earned: MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
      },
      mutagens_bank: bank,
      mutagen_forming_started_at_ms: startedAt,
      total_mutagens_acquired: acquired,
    };
  }

  it("auto-collects only after the 4-hour grace window", () => {
    const T0 = 1_000_000;
    const hour = 60 * 60 * 1000;
    const slice = unlockedSlice(T0, 1, 1);

    expect(autoCollectMutagen(slice, T0 + 19 * hour)).toBeNull();
    expect(autoCollectMutagen(slice, T0 + 22 * hour)).toBeNull();

    const auto = autoCollectMutagen(slice, T0 + 24 * hour);
    expect(auto).not.toBeNull();
    expect(auto!.mutagens_bank).toBe(2);
    expect(auto!.mutagen_forming_started_at_ms).toBe(T0 + 24 * hour);
  });

  it("settles offline mutagen progress with grace", () => {
    const T0 = 1_000_000;
    const hour = 60 * 60 * 1000;
    const slice = unlockedSlice(T0);

    expect(settleMutagenPipeline(slice, T0 + 19 * hour)).toMatchObject({
      mutagens_bank: 0,
      mutagen_forming_started_at_ms: T0,
      completedCount: 0,
    });

    expect(settleMutagenPipeline(slice, T0 + 22 * hour)).toMatchObject({
      mutagens_bank: 0,
      mutagen_forming_started_at_ms: T0,
      completedCount: 0,
    });
    expect(isMutagenCollectible(T0, T0 + 22 * hour)).toBe(true);

    expect(settleMutagenPipeline(slice, T0 + 24 * hour)).toMatchObject({
      mutagens_bank: 1,
      mutagen_forming_started_at_ms: T0 + 24 * hour,
      total_mutagens_acquired: 1,
      completedCount: 1,
    });

    expect(settleMutagenPipeline(slice, T0 + 71 * hour)).toMatchObject({
      mutagens_bank: 2,
      mutagen_forming_started_at_ms: T0 + 48 * hour,
      total_mutagens_acquired: 2,
      completedCount: 2,
    });
    expect(isMutagenCollectible(T0 + 48 * hour, T0 + 71 * hour)).toBe(true);

    expect(settleMutagenPipeline(slice, T0 + 72 * hour)).toMatchObject({
      mutagens_bank: 3,
      mutagen_forming_started_at_ms: T0 + 72 * hour,
      total_mutagens_acquired: 3,
      completedCount: 3,
    });
  });

  it("msUntilMutagenAutoCollect includes formation plus grace", () => {
    const T0 = 100_000;
    expect(msUntilMutagenAutoCollect(T0, T0)).toBe(
      MUTAGEN_FORMATION_MS + MUTAGEN_AUTO_COLLECT_GRACE_MS,
    );
    expect(msUntilMutagenAutoCollect(0, T0)).toBe(Number.POSITIVE_INFINITY);
  });
});
