import { describe, expect, it } from "vitest";

import {
  applyCampaignEvent,
  createInitialCampaignProgress,
  formatActiveObjectiveLine,
  formatActSummaryLine,
  formatMidCombatResumeHint,
  getActiveObjective,
  getCurrentAct,
  isMidCombatSaveState,
  normalizeCampaignProgress,
} from "./squallsCampaign";

describe("squallsCampaign", () => {
  it("starts on First Squall with Sail as the active objective", () => {
    const progress = createInitialCampaignProgress();
    expect(getCurrentAct(progress).id).toBe("act1");
    expect(getActiveObjective(progress)?.id).toBe("first_sail");
    expect(formatActiveObjectiveLine(progress)).toContain("Sail");
  });

  it("advances objectives through sail → land → victory into Act II", () => {
    let progress = createInitialCampaignProgress();
    progress = applyCampaignEvent(progress, "sail");
    expect(getActiveObjective(progress)?.id).toBe("first_landing");

    progress = applyCampaignEvent(progress, "land");
    expect(getActiveObjective(progress)?.id).toBe("first_victory");

    progress = applyCampaignEvent(progress, "victory");
    expect(getCurrentAct(progress).id).toBe("act2");
    expect(getActiveObjective(progress)?.id).toBe("first_dungeon");
  });

  it("treats boss_slain as both a boss kill and a battle win", () => {
    let progress = createInitialCampaignProgress();
    progress = applyCampaignEvent(progress, "sail");
    progress = applyCampaignEvent(progress, "land");
    progress = applyCampaignEvent(progress, "boss_slain");
    expect(progress.battlesWon).toBe(1);
    expect(progress.bossesSlain).toBe(1);
    expect(progress.completedObjectiveIds).toContain("first_victory");
    expect(progress.completedObjectiveIds).toContain("first_boss");
  });

  it("reaches Deep Water after Act II objectives", () => {
    let progress = createInitialCampaignProgress();
    for (const event of [
      "sail",
      "land",
      "victory",
      "enter_dungeon",
      "boss_slain",
      "visit_port",
    ] as const) {
      progress = applyCampaignEvent(progress, event);
    }
    expect(getCurrentAct(progress).id).toBe("act3");
    expect(getActiveObjective(progress)?.id).toBe("deep_waters");
    expect(formatActSummaryLine(progress)).toContain("Deep Water");
  });

  it("normalizes incomplete save blobs safely", () => {
    expect(normalizeCampaignProgress(null).sailsCompleted).toBe(0);
    expect(
      normalizeCampaignProgress({
        sailsCompleted: 2.7,
        completedObjectiveIds: ["first_sail", "nope", "first_sail"],
      }).completedObjectiveIds,
    ).toEqual(["first_sail"]);
  });

  it("flags mid-combat resume states", () => {
    expect(isMidCombatSaveState("battle", null)).toBe(true);
    expect(isMidCombatSaveState("lobby", "battle")).toBe(true);
    expect(isMidCombatSaveState("home", null)).toBe(false);
    expect(formatMidCombatResumeHint()).toMatch(/Battle paused/);
  });
});
