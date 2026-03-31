import type { User } from "@auth0/auth0-react";
import { createContext, useContext } from "react";

export type Profile = {
  display_name: string;
  avatar_url: string;
  timezone: string;
  birth_date: string | null;
};

export type AppUser = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_authenticated: boolean;
  is_approved: boolean;
  account_status: string;
  auth0_sub?: string | null;
};

export type SessionUser = {
  user: AppUser;
  profile: Profile;
};

export type ProfilePatch = Partial<
  Pick<Profile, "display_name" | "avatar_url" | "timezone" | "birth_date">
>;

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
