import { describe, expect, it } from "vitest";

import { DENIZEN_IDS } from "./denizens";
import {
  activeHeadlineForDenizen,
  buildHeadlineRotationCandidates,
  headlineDisplayLines,
  HEADLINES,
  HEADLINES_BY_DENIZEN,
  pickNextHeadlineRotation,
} from "./headlines";

describe("headlines", () => {
  it("shows highest owned-count tier for a denizen", () => {
    expect(activeHeadlineForDenizen({ ripples: 1 }, "ripples")?.id).toBe(
      "ripples_1",
    );
    expect(activeHeadlineForDenizen({ ripples: 80 }, "ripples")?.id).toBe(
      "ripples_75",
    );
    expect(activeHeadlineForDenizen({ ripples: 100 }, "ripples")?.id).toBe(
      "ripples_100",
    );
    expect(activeHeadlineForDenizen({ ripples: 0 }, "ripples")).toBeUndefined();
  });

  it("falls through sparse tier gaps", () => {
    expect(activeHeadlineForDenizen({ fungi: 10 }, "fungi")?.id).toBe("fungi_1");
    expect(activeHeadlineForDenizen({ fungi: 30 }, "fungi")?.id).toBe("fungi_25");
    expect(activeHeadlineForDenizen({ zooplankton: 15 }, "zooplankton")?.id).toBe(
      "zooplankton_10",
    );
  });

  it("builds one candidate per owned denizen at its highest tier", () => {
    const candidates = buildHeadlineRotationCandidates({
      ripples: 80,
      sediment: 3,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.find((c) => c.denizenId === "ripples")?.headline.id).toBe(
      "ripples_75",
    );
    expect(candidates.find((c) => c.denizenId === "sediment")?.headline.id).toBe(
      "sediment_1",
    );
  });

  it("prefers a different headline and denizen on rotation when possible", () => {
    const owned = { ripples: 80, sediment: 50 };
    const previous = {
      denizenId: "ripples",
      headlineId: "ripples_75",
    };
    const next = pickNextHeadlineRotation(owned, previous, () => 0);
    expect(next?.denizenId).toBe("sediment");
    expect(next?.headlineId).toBe("sediment_50");
  });

  it("repeats when only one owned denizen exists", () => {
    const owned = { ripples: 80 };
    const previous = {
      denizenId: "ripples",
      headlineId: "ripples_75",
    };
    const next = pickNextHeadlineRotation(owned, previous, () => 0);
    expect(next).toEqual(previous);
  });

  it("splits haiku headlines on slashes", () => {
    expect(headlineDisplayLines("A / B / C")).toEqual(["A", "B", "C"]);
    expect(headlineDisplayLines("Plain prose headline.")).toEqual([
      "Plain prose headline.",
    ]);
  });

  it("catalog is sorted by unlockOwned within each denizen", () => {
    for (const headlines of Object.values(HEADLINES_BY_DENIZEN)) {
      for (let i = 1; i < headlines.length; i++) {
        expect(headlines[i]!.unlockOwned).toBeGreaterThan(
          headlines[i - 1]!.unlockOwned,
        );
      }
    }
  });

  it("uses valid denizen ids throughout the catalog", () => {
    for (const def of HEADLINES) {
      expect(DENIZEN_IDS.has(def.denizenId)).toBe(true);
    }
  });
});
