import { describe, expect, it } from "vitest";

import { getSpecialtyDef } from "./specialties";
import { isSpecialtyShopVisible, isSpecialtyUnlocked } from "./visibility";

const FIRST_PUDDLE_ID = 166;
const TRICKLE_IN_ID = 167;
const HIDDEN_SPRING_ID = 168;

describe("pond production chain prerequisites", () => {
  const firstPuddle = () => getSpecialtyDef(FIRST_PUDDLE_ID)!;
  const trickleIn = () => getSpecialtyDef(TRICKLE_IN_ID)!;
  const hiddenSpring = () => getSpecialtyDef(HIDDEN_SPRING_ID)!;

  it("defines sequential requiresOwnedSpecialtyId through the chain", () => {
    expect(firstPuddle().requiresOwnedSpecialtyId).toBeUndefined();
    expect(trickleIn().requiresOwnedSpecialtyId).toBe(FIRST_PUDDLE_ID);
    expect(hiddenSpring().requiresOwnedSpecialtyId).toBe(TRICKLE_IN_ID);
  });

  it("shows Trickle In only after First Puddle is owned", () => {
    const enoughEnergy = 1e15;
    expect(
      isSpecialtyUnlocked(trickleIn(), {}, enoughEnergy, 0, 0, {}),
    ).toBe(false);
    expect(
      isSpecialtyShopVisible(trickleIn(), {}, {}, enoughEnergy, 0, 0),
    ).toBe(false);
    expect(
      isSpecialtyUnlocked(
        trickleIn(),
        {},
        enoughEnergy,
        0,
        0,
        { [FIRST_PUDDLE_ID]: true },
      ),
    ).toBe(true);
    expect(
      isSpecialtyShopVisible(
        trickleIn(),
        {},
        { [FIRST_PUDDLE_ID]: true },
        enoughEnergy,
        0,
        0,
      ),
    ).toBe(true);
  });

  it("still requires lifetime energy threshold for First Puddle", () => {
    expect(isSpecialtyUnlocked(firstPuddle(), {}, 0, 0, 0, {})).toBe(false);
    expect(
      isSpecialtyUnlocked(firstPuddle(), {}, 50_000, 0, 0, {}),
    ).toBe(true);
  });
});
