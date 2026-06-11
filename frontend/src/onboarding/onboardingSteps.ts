import type { Profile } from "../auth/AppSessionContext";
import { profileHasUploadedAvatar } from "../appNavConfig";

export const ONBOARDING_STEP_COUNT = 7;

export type OnboardingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function isOnboardingStep(n: number): n is OnboardingStepNumber {
  return Number.isInteger(n) && n >= 1 && n <= ONBOARDING_STEP_COUNT;
}

export function shouldSkipAvatarStep(profile: Profile | null | undefined): boolean {
  return profileHasUploadedAvatar(profile);
}

export function normalizeOnboardingStep(
  step: number,
  profile: Profile | null | undefined,
): OnboardingStepNumber {
  const clamped = Math.min(
    ONBOARDING_STEP_COUNT,
    Math.max(1, Math.floor(step) || 1),
  ) as OnboardingStepNumber;
  if (clamped === 4 && shouldSkipAvatarStep(profile)) {
    return 5;
  }
  return clamped;
}

export function resolveOnboardingStep(profile: Profile | null | undefined): OnboardingStepNumber {
  return normalizeOnboardingStep(profile?.onboarding_step ?? 1, profile);
}

export function resolveOnboardingPath(profile: Profile | null | undefined): string {
  return `/onboarding/${resolveOnboardingStep(profile)}`;
}

export function nextOnboardingStep(
  step: OnboardingStepNumber,
  profile: Profile | null | undefined,
): OnboardingStepNumber {
  let n = step + 1;
  if (n === 4 && shouldSkipAvatarStep(profile)) {
    n = 5;
  }
  return Math.min(ONBOARDING_STEP_COUNT, n) as OnboardingStepNumber;
}

export function priorOnboardingStep(
  step: OnboardingStepNumber,
  profile: Profile | null | undefined,
): OnboardingStepNumber | null {
  if (step <= 1) return null;
  let n = step - 1;
  if (n === 4 && shouldSkipAvatarStep(profile)) {
    n = 3;
  }
  return n as OnboardingStepNumber;
}
