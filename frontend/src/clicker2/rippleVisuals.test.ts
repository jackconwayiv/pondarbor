import { describe, expect, it } from "vitest";

import { specialtiesForDenizen } from "./specialties";
import {
  ownedClickRippleVisualEvolutionCount,
  RIPPLE_VISUAL_BORDER_ALPHA_MAX,
  RIPPLE_VISUAL_BORDER_ALPHA_MIN,
  RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX,
  RIPPLE_VISUAL_OPACITY_START_MAX,
  RIPPLE_VISUAL_OPACITY_START_MIN,
  rippleVisualStyleFromEvolutionCount,
  rippleVisualStyleFromOwnedSpecialties,
} from "./rippleVisuals";

describe("rippleVisuals", () => {
  it("counts owned Ripples and Click reflection evolutions only", () => {
    const ripples = specialtiesForDenizen("ripples");
    const click = specialtiesForDenizen("click");
    const owned = {
      [ripples[0]!.id]: true,
      [ripples[1]!.id]: true,
      [click[0]!.id]: true,
    };
    expect(ownedClickRippleVisualEvolutionCount(owned)).toBe(3);
    expect(ownedClickRippleVisualEvolutionCount({})).toBe(0);
  });

  it("starts at legacy baseline with no qualifying evolutions", () => {
    const style = rippleVisualStyleFromEvolutionCount(0);
    expect(style.opacityStart).toBe(RIPPLE_VISUAL_OPACITY_START_MIN);
    expect(style.borderAlpha).toBe(RIPPLE_VISUAL_BORDER_ALPHA_MIN);
  });

  it("ramps linearly above legacy baseline and caps at max visibility", () => {
    const mid = rippleVisualStyleFromEvolutionCount(10);
    expect(mid.opacityStart).toBeGreaterThan(RIPPLE_VISUAL_OPACITY_START_MIN);
    expect(mid.opacityStart).toBeLessThan(RIPPLE_VISUAL_OPACITY_START_MAX);

    const max = rippleVisualStyleFromEvolutionCount(
      RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX,
    );
    expect(max.opacityStart).toBeCloseTo(RIPPLE_VISUAL_OPACITY_START_MAX, 10);
    expect(max.borderAlpha).toBeCloseTo(RIPPLE_VISUAL_BORDER_ALPHA_MAX, 10);

    const beyond = rippleVisualStyleFromEvolutionCount(999);
    expect(beyond.opacityStart).toBeCloseTo(RIPPLE_VISUAL_OPACITY_START_MAX, 10);
    expect(beyond.borderAlpha).toBeCloseTo(RIPPLE_VISUAL_BORDER_ALPHA_MAX, 10);
  });

  it("derives style from owned specialties map", () => {
    const ripples = specialtiesForDenizen("ripples");
    const style = rippleVisualStyleFromOwnedSpecialties({
      [ripples[0]!.id]: true,
    });
    expect(style.evolutionCount).toBe(1);
    expect(style.opacityStart).toBeGreaterThan(RIPPLE_VISUAL_OPACITY_START_MIN);
  });
});
