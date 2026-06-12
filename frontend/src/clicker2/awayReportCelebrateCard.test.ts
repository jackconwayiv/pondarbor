import { describe, expect, it } from "vitest";

import {
  AWAY_REPORT_FAE_ENERGY_CARD_MIN,
  shouldShowAwayReportFaeEnergyCard,
} from "./AwayReportCelebrateCard";

describe("shouldShowAwayReportFaeEnergyCard", () => {
  it("hides cards below the minimum threshold", () => {
    expect(AWAY_REPORT_FAE_ENERGY_CARD_MIN).toBe(100);
    expect(shouldShowAwayReportFaeEnergyCard(0)).toBe(false);
    expect(shouldShowAwayReportFaeEnergyCard(99)).toBe(false);
    expect(shouldShowAwayReportFaeEnergyCard(99.9)).toBe(false);
  });

  it("shows cards at or above the minimum threshold", () => {
    expect(shouldShowAwayReportFaeEnergyCard(100)).toBe(true);
    expect(shouldShowAwayReportFaeEnergyCard(250)).toBe(true);
  });
});
