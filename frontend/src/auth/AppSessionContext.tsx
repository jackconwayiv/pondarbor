import type { User } from "@auth0/auth0-react";
import { createContext, useContext } from "react";

import type { AchievementSummary } from "../achievements/types";

export type Profile = {
  display_name: string;
  avatar_url: string;
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
  >
> & {
  avatar_image_key?: string;
};

export type AppSessionContextValue = {
  sessionUser: SessionUser | null;
  auth0User: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  getApiAccessToken: () => Promise<string>;
  refreshSession: () => Promise<void>;
  updateProfileLocally: (patch: Partial<Profile>) => void;
  patchMyProfile: (patch: ProfilePatch) => Promise<void>;
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
