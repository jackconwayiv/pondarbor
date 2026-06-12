import { describe, expect, it } from "vitest";

import type { SessionUser } from "../auth/AppSessionContext";
import { shouldWaitForOnboardingServerSync } from "./onboardingGateSync";

const sessionUser = {
  user: {
    id: 1,
    email: "a@example.com",
    username: "",
    first_name: "",
    last_name: "",
    is_authenticated: true,
    is_approved: true,
    account_status: "approved",
  },
  profile: {
    display_name: "A",
    avatar_url: "",
    timezone: "America/Phoenix",
    birth_date: null,
    meal_week_starts_on: 0,
    meal_crud_partner_id: null,
    meal_pair_mutual: false,
    onboarding_completed: false,
  },
} satisfies SessionUser;

describe("shouldWaitForOnboardingServerSync", () => {
  it("waits when cached session exists but server sync has not finished", () => {
    expect(
      shouldWaitForOnboardingServerSync(true, sessionUser, false),
    ).toBe(true);
  });

  it("does not wait when cache already marks onboarding complete", () => {
    const completedUser = {
      ...sessionUser,
      profile: { ...sessionUser.profile, onboarding_completed: true },
    };
    expect(
      shouldWaitForOnboardingServerSync(true, completedUser, false),
    ).toBe(false);
  });

  it("does not wait after server sync", () => {
    expect(
      shouldWaitForOnboardingServerSync(true, sessionUser, true),
    ).toBe(false);
  });

  it("does not wait for guests", () => {
    expect(shouldWaitForOnboardingServerSync(false, null, false)).toBe(false);
  });
});
