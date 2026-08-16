import { describe, expect, it } from "vitest";

import type { Profile } from "./auth/AppSessionContext";
import {
  DEFAULT_STARRED_APP_PATHS,
  getHomeTrailingApps,
  getOnboardingStarableApps,
  hasUnstarredApps,
  resolveAppPathFromLocation,
  starAllAccessibleAppPaths,
} from "./appNavConfig";

describe("getOnboardingStarableApps", () => {
  const nonStaff = {
    isAuthenticated: true,
    isApproved: true,
    isStaff: false,
  };
  const staff = { ...nonStaff, isStaff: true };

  it("hides staff-only games from non-staff", () => {
    const paths = getOnboardingStarableApps(nonStaff).map((item) => item.to);
    expect(paths).not.toContain("/qff");
    expect(paths).not.toContain("/harbor");
    expect(paths).not.toContain("/squalls");
  });

  it("includes staff-only games for staff", () => {
    const paths = getOnboardingStarableApps(staff).map((item) => item.to);
    expect(paths).toContain("/qff");
    expect(paths).toContain("/harbor");
    expect(paths).toContain("/squalls");
  });

  it("includes Books for starring on the homepage", () => {
    const paths = getOnboardingStarableApps(nonStaff).map((item) => item.to);
    expect(paths).toContain("/books");
    expect([...DEFAULT_STARRED_APP_PATHS]).toContain("/books");
  });
});

describe("hasUnstarredApps", () => {
  const nonStaff = {
    isAuthenticated: true,
    isApproved: true,
    isStaff: false,
  };

  it("is true with default starred apps", () => {
    expect(hasUnstarredApps(nonStaff, null)).toBe(true);
  });

  it("is false when every accessible app is starred", () => {
    const allPaths = starAllAccessibleAppPaths(nonStaff);
    const profile = { home_starred_app_paths: allPaths } as Profile;
    expect(hasUnstarredApps(nonStaff, profile)).toBe(false);
    expect(
      getHomeTrailingApps(nonStaff, profile).some((item) => item.to === "/explore"),
    ).toBe(false);
  });
});

describe("resolveAppPathFromLocation", () => {
  it("does not resolve friend profiles to a starable app", () => {
    expect(resolveAppPathFromLocation("/friend/42")).toBeNull();
    expect(resolveAppPathFromLocation("/users/alice@example.com/public-quotes")).toBeNull();
  });

  it("resolves quotes routes for starring", () => {
    expect(resolveAppPathFromLocation("/quotes")).toBe("/quotes");
    expect(resolveAppPathFromLocation("/quotes/public")).toBe("/quotes");
  });
});

describe("starAllAccessibleAppPaths", () => {
  const nonStaff = {
    isAuthenticated: true,
    isApproved: true,
    isStaff: false,
  };

  it("lists every starable app the user can access", () => {
    const paths = starAllAccessibleAppPaths(nonStaff);
    const expected = getOnboardingStarableApps(nonStaff).map((item) => item.to);
    expect([...paths].sort()).toEqual([...expected].sort());
    expect(paths).not.toContain("/qff");
  });
});
