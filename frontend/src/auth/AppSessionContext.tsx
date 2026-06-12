import type { User } from "@auth0/auth0-react";
import { createContext, useContext } from "react";

import type { AchievementSummary } from "../achievements/types";
import type { BootstrapInboxSnapshot } from "../users/api";

export type Profile = {
  display_name: string;
  avatar_url: string;
  avatar_image_key?: string;
  timezone: string;
  birth_date: string | null;
  /** True after the user has finished at least one WhatIf session (server-set). */
  whatif_completed_session?: boolean;
  /** Python weekday: Monday=0 … Sunday=6 */
  meal_week_starts_on: number;
  meal_crud_partner_id: number | null;
  /** Partner’s display name (or email local-part); empty when no partner. */
  meal_crud_partner_label?: string;
  meal_pair_mutual: boolean;
  /** Someone chose you as meal partner; mutual pairing not complete yet. */
  meal_partner_incoming_pending?: boolean;
  /** Keys "1"…"5" → label list for that many meals per day; null = use app defaults. */
  meal_slot_labels?: Record<string, string[]> | null;
  /** Pantry inventory and grocery hints (Meal Maestro). */
  meal_pantry_enabled?: boolean;
  /** Meal plan rows per day (1–5); adding a row applies to every day. */
  meal_slots_per_day?: number;
  /** User finished the Meal Maestro setup wizard. */
  meal_maestro_setup_completed?: boolean;
  /** Dietary labels from setup wizard (meal tags + pantry defaults). */
  meal_dietary_preferences?: string[];
  /** Show Sun/Moon/Rising on friend profile (does not affect /zodiac Friends tab). */
  display_astro?: boolean;
  /** Default audience for newly created social objects (global). */
  social_publish_visibility?: "all_approved" | "friends_only";
  /** Feed/discover preference for what you read (soft filter). */
  social_read_scope?: "approved_users" | "friends_only";
  /** Who can see your Song-a-Day submissions. */
  songaday_visibility?: "private" | "friends_only" | "all_approved";
  /** Achievement slugs whose bell notices have been acknowledged account-wide. */
  achievement_inbox_read_slugs?: string[];
  /** App paths starred on home; null = product defaults. */
  home_starred_app_paths?: string[] | null;
  onboarding_completed?: boolean;
  onboarding_step?: number;
};

export type AppUser = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_authenticated: boolean;
  is_approved: boolean;
  is_staff?: boolean;
  account_status: string;
  auth0_sub?: string | null;
  /** ISO datetime from Django `date_joined`; omitted in older cached sessions. */
  date_joined?: string | null;
};

export type SessionUser = {
  user: AppUser;
  profile: Profile;
  achievements?: AchievementSummary[];
};

export function resolveCurrentUserAvatarUrl(
  sessionUser: SessionUser | null | undefined,
  auth0User: User | null | undefined,
): string {
  const profileAvatar = (sessionUser?.profile.avatar_url ?? "").trim();
  if (profileAvatar) return profileAvatar;
  return (auth0User?.picture ?? "").trim();
}

export function resolveAvatarUrlForUser(
  apiAvatarUrl: string | null | undefined,
  userId: number | null | undefined,
  sessionUser: SessionUser | null | undefined,
  auth0User: User | null | undefined,
): string {
  if (userId != null && sessionUser?.user.id === userId) {
    return (
      resolveCurrentUserAvatarUrl(sessionUser, auth0User) ||
      (apiAvatarUrl ?? "").trim()
    );
  }
  return (apiAvatarUrl ?? "").trim();
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "display_name"
    | "avatar_url"
    | "timezone"
    | "birth_date"
    | "meal_week_starts_on"
    | "meal_crud_partner_id"
    | "meal_slot_labels"
    | "meal_pantry_enabled"
    | "meal_slots_per_day"
    | "meal_maestro_setup_completed"
    | "meal_dietary_preferences"
    | "display_astro"
    | "social_publish_visibility"
    | "social_read_scope"
    | "songaday_visibility"
    | "home_starred_app_paths"
    | "onboarding_completed"
    | "onboarding_step"
  >
> & {
  avatar_image_key?: string;
};

export type AppSessionContextValue = {
  sessionUser: SessionUser | null;
  auth0User: User | null;
  accessToken: string | null;
  /** Inbox/bell preloaded with POST /users/bootstrap/ or restored from sessionStorage. */
  bootstrapInboxSnapshot: BootstrapInboxSnapshot | null;
  /** When `bootstrapInboxSnapshot` was obtained (ms since epoch). */
  bootstrapInboxFetchedAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True after the latest login’s server bootstrap/sync succeeded (or failed with cache fallback). */
  sessionSyncedFromServer: boolean;
  error: string | null;
  getApiAccessToken: () => Promise<string>;
  /** Full re-bootstrap (clears cache; use for recovery / reconnect). */
  refreshSession: () => Promise<void>;
  /**
   * POSTs sync-profile and updates `sessionUser` without clearing the session or
   * toggling the global bootstrapping/loading state (safe during media, games, etc.).
   */
  resyncSessionSilently: () => Promise<void>;
  updateProfileLocally: (patch: Partial<Profile>) => void;
  /** Starred home apps; null = product defaults. Updated without replacing `sessionUser`. */
  homeStarredAppPaths: string[] | null;
  patchHomeStarredAppPaths: (paths: string[]) => Promise<void>;
  patchMyProfile: (
    patch: ProfilePatch,
    options?: { replaceSession?: boolean },
  ) => Promise<void>;
  /** `true` = show to friends (server stores null); `false` = hidden from friends. */
  patchAchievementVisibility: (slug: string, visibleToFriends: boolean) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: () => void;
};

export const AppSessionContext = createContext<
  AppSessionContextValue | undefined
>(undefined);

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return context;
}
