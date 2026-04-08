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
};

export type SessionUser = {
  user: AppUser;
  profile: Profile;
  achievements?: AchievementSummary[];
};

export type ProfilePatch = Partial<
  Pick<Profile, "display_name" | "avatar_url" | "timezone" | "birth_date">
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
