import type { User } from "@auth0/auth0-react";
import { createContext, useContext } from "react";

export type Profile = {
  display_name: string;
  avatar_url: string;
  timezone: string;
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
  Pick<Profile, "display_name" | "avatar_url" | "timezone">
>;

export type AppSessionContextValue = {
  sessionUser: SessionUser | null;
  auth0User: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  updateProfileLocally: (patch: Partial<Profile>) => void;
  patchMyProfile: (patch: ProfilePatch) => Promise<void>;
  logout: () => void;
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
