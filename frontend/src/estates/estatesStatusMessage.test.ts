import { describe, expect, it } from "vitest";

import {
  formatOpponentLastPlacement,
  personalizeEstatesStatusMessage,
} from "./estatesStatusMessage";

describe("formatOpponentLastPlacement", () => {
  it("formats opponent play with zone article", () => {
    expect(
      formatOpponentLastPlacement({
        lastPlacement: { seat: 2, zone: "road", rank: 3, suit: "noble" },
        mySeat: 1,
        opponentDisplayName: "Guest",
      }),
    ).toBe("Guest plays 3 Noble at the Road.");
  });

  it("returns null when last play was mine", () => {
    expect(
      formatOpponentLastPlacement({
        lastPlacement: { seat: 1, zone: "road", rank: 3, suit: "noble" },
        mySeat: 1,
        opponentDisplayName: "Guest",
      }),
    ).toBeNull();
  });

  it("returns null for invalid payload", () => {
    expect(
      formatOpponentLastPlacement({
        lastPlacement: null,
        mySeat: 1,
        opponentDisplayName: "Guest",
      }),
    ).toBeNull();
  });
});

describe("personalizeEstatesStatusMessage", () => {
  it("personalizes Road win copy with the", () => {
    expect(
      personalizeEstatesStatusMessage(
        "Host wins the Road and will draw 2 extra cards next round.",
        "Host",
      ),
    ).toBe("You won the Road and will draw 2 extra cards next round.");
  });

  it("leaves opponent messages unchanged", () => {
    expect(
      personalizeEstatesStatusMessage(
        "Guest wins the Road and will draw 2 extra cards next round.",
        "Host",
      ),
    ).toBe("Guest wins the Road and will draw 2 extra cards next round.");
  });
});
