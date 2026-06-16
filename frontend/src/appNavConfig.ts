/**
 * App navigation metadata: shared by the home page and the app shell (desktop + hamburger).
 */
import type { Profile } from "./auth/AppSessionContext";
import {
  GAMES_MENU_STAFF_ITEMS,
  GAME_NAV_ITEMS,
  type GameNavItem,
} from "./gamesNavConfig";

export type AppNavItem = {
  to: string;
  emoji: string;
  /** Full name (home list, hamburger, tooltips). */
  label: string;
  /** Shorter name for the desktop top bar; defaults to `label`. */
  navLabel?: string;
  blurb: string;
};

export type NavCategory = {
  id: "social" | "lifestyle" | "games";
  label: string;
  emoji: string;
  items: AppNavItem[];
};

export function navLinkLabel(item: AppNavItem): string {
  return item.navLabel ?? item.label;
}

/** Desktop header: app link label colors (navy bar). */
export const NAV_HEADER_LINK_TEXT = {
  active: "white",
  inactive: "rgba(245, 241, 232, 0.75)",
} as const;

export const DEFAULT_STARRED_APP_PATHS = [
  "/calendar",
  "/closet",
  "/people",
  "/clicker",
  "/whatif",
  "/recommendations",
] as const;

const STARABLE_APP_PATHS = new Set<string>([
  "/songaday",
  "/calendar",
  "/closet",
  "/quotes",
  "/people",
  "/goals",
  "/zodiac",
  "/meal",
  "/scorenado",
  "/clicker",
  "/whatif",
  "/estates",
  "/qff",
  "/harbor",
  "/squalls",
  "/recommendations",
]);

const STAFF_ONLY_GAME_PATHS = new Set(["/qff", "/harbor", "/squalls"]);

const WHATIF: AppNavItem = {
  to: "/whatif",
  emoji: "🎲",
  label: "WhatIf",
  blurb: "Party game played with a TV and phones.",
};

export const ABOUT: AppNavItem = {
  to: "/about",
  emoji: "🐢",
  label: "About",
  blurb: "Project info, terms, and privacy.",
};

const SONGADAY: AppNavItem = {
  to: "/songaday",
  emoji: "🎶",
  label: "Song-a-Day",
  blurb: "Daily song prompts; share the perfect tune.",
};

const CALENDAR: AppNavItem = {
  to: "/calendar",
  emoji: "🗓️",
  label: "Calendar",
  blurb: "Social calendar-sharing app.",
};

const CLOSET: AppNavItem = {
  to: "/closet",
  emoji: "👒",
  label: "Community Closet",
  blurb: "Lend and borrow items with friends.",
};

const QUOTES: AppNavItem = {
  to: "/quotes",
  emoji: "📜",
  label: "Quotes",
  blurb: "Archive of noteworthy quotes.",
};

const RECOMMENDATIONS: AppNavItem = {
  to: "/recommendations",
  emoji: "🧭",
  label: "Recommenda",
  blurb: "Share places and media with friends.",
};

export const GOALS_APP: AppNavItem = {
  to: "/goals",
  emoji: "🏅",
  label: "Goal-Getter",
  blurb: "Private goals, checkpoints, and check-ins.",
};

const ZODIAC: AppNavItem = {
  to: "/zodiac",
  emoji: "🌞",
  label: "Zodiackary",
  blurb: "Get a natal chart based on birth details.",
};

const MEAL: AppNavItem = {
  to: "/meal",
  emoji: "🧑‍🍳",
  label: "Meal Maestro",
  blurb: "Meal planner and recipe manager.",
};

const SCORENADO: AppNavItem = {
  to: "/scorenado",
  emoji: "♣️",
  label: "Scorenado",
  blurb: "Create scoreboards and score games.",
};

const FAMILY_TREE: AppNavItem = {
  to: "/people",
  emoji: "🌳",
  label: "Family Tree",
  blurb: "Share your family tree with friends.",
};

const PROFILE: AppNavItem = {
  to: "/profile",
  emoji: "👤",
  label: "Profile",
  blurb: "Your profile and account settings.",
};

export const EXPLORE_APP: AppNavItem = {
  to: "/explore",
  emoji: "🗺️",
  label: "Explore",
  blurb: "",
};

export const FRIENDS_HOME_APP: AppNavItem = {
  to: "/profile?tab=friends",
  emoji: "👥",
  label: "My Friends",
  blurb: "Your friends list.",
};

export const FIXED_HOME_TRAILING_APPS: AppNavItem[] = [
  { ...EXPLORE_APP, label: "Explore Apps" },
  { ...PROFILE, label: "My Profile" },
  FRIENDS_HOME_APP,
  ABOUT,
];

function gameToAppNav(item: GameNavItem, blurb = ""): AppNavItem {
  return {
    to: item.to,
    emoji: item.emoji,
    label: item.label,
    blurb,
  };
}

const PONDCLICKER = gameToAppNav(
  GAME_NAV_ITEMS.find((g) => g.to === "/clicker")!,
  "Click in this idle game to grow your pond.",
);
const ESTATES = gameToAppNav(
  GAME_NAV_ITEMS.find((g) => g.to === "/estates")!,
  "Head-to-head card-placing game.",
);
const QFF = gameToAppNav(
  GAME_NAV_ITEMS.find((g) => g.to === "/qff")!,
  "Text-based multiplayer RPG.",
);
const HARBOR = gameToAppNav(
  GAMES_MENU_STAFF_ITEMS.find((g) => g.to === "/harbor")!,
  "Singleplayer harbor management sim.",
);
const SQUALLS = gameToAppNav(
  GAMES_MENU_STAFF_ITEMS.find((g) => g.to === "/squalls")!,
  "Roguelike pirate adventure game.",
);

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "social",
    label: "Social",
    emoji: "💬",
    items: [SONGADAY, CALENDAR, CLOSET, QUOTES, RECOMMENDATIONS, FAMILY_TREE],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    emoji: "🌞",
    items: [GOALS_APP, ZODIAC, MEAL],
  },
  {
    id: "games",
    label: "Games",
    emoji: "🎲",
    items: [SCORENADO, WHATIF, PONDCLICKER, ESTATES, QFF, HARBOR, SQUALLS],
  },
];

export function guestHamburgerNavItems(): AppNavItem[] {
  return [WHATIF, ABOUT];
}

export type AppNavAccess = {
  isAuthenticated: boolean;
  isApproved: boolean;
  isStaff: boolean;
};

export function isNavItemAccessible(
  item: AppNavItem,
  { isAuthenticated, isApproved, isStaff }: AppNavAccess,
): boolean {
  if (item.to === "/meal" || item.to === "/scorenado") {
    return isAuthenticated && isApproved;
  }
  if (STAFF_ONLY_GAME_PATHS.has(item.to)) {
    return isStaff;
  }
  return true;
}

export function getFilteredCategoryItems(
  category: NavCategory,
  access: AppNavAccess,
): AppNavItem[] {
  return category.items.filter((item) => isNavItemAccessible(item, access));
}

export function getEffectiveStarredPaths(
  profile: Profile | null | undefined,
): string[] {
  const stored = profile?.home_starred_app_paths;
  if (stored == null) {
    return [...DEFAULT_STARRED_APP_PATHS];
  }
  return stored;
}

export function isStarableAppPath(path: string): boolean {
  return STARABLE_APP_PATHS.has(path);
}

export function isPathStarred(
  path: string,
  profile: Profile | null | undefined,
): boolean {
  return getEffectiveStarredPaths(profile).includes(path);
}

export function toggleHomeStarredPath(
  path: string,
  profile: Profile | null | undefined,
): string[] {
  const base =
    profile?.home_starred_app_paths == null
      ? [...DEFAULT_STARRED_APP_PATHS]
      : [...profile.home_starred_app_paths];
  if (base.includes(path)) {
    return base.filter((p) => p !== path);
  }
  return [...base, path];
}

export function resolveAppPathFromLocation(
  pathname: string,
  search: string = "",
): string | null {
  const p =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname || "/";
  if (p === "/profile") {
    const tab = new URLSearchParams(search || "").get("tab");
    if (tab === "friends") return null;
    return null;
  }
  const prefixes: [string, string][] = [
    ["/songaday", "/songaday"],
    ["/calendar", "/calendar"],
    ["/closet", "/closet"],
    ["/quotes", "/quotes"],
    ["/recommendations", "/recommendations"],
    ["/goals", "/goals"],
    ["/zodiac", "/zodiac"],
    ["/meal", "/meal"],
    ["/scorenado", "/scorenado"],
    ["/people", "/people"],
    ["/clicker", "/clicker"],
    ["/whatif", "/whatif"],
    ["/estates", "/estates"],
    ["/qff", "/qff"],
    ["/harbor", "/harbor"],
    ["/squalls", "/squalls"],
  ];
  for (const [prefix, root] of prefixes) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return isStarableAppPath(root) ? root : null;
    }
  }
  return null;
}

function allStarableNavItems(access: AppNavAccess): AppNavItem[] {
  const items: AppNavItem[] = [];
  for (const category of NAV_CATEGORIES) {
    for (const item of getFilteredCategoryItems(category, access)) {
      if (isStarableAppPath(item.to)) {
        items.push(item);
      }
    }
  }
  return items;
}

export function getExploreGridItems(
  access: AppNavAccess,
  profile: Profile | null | undefined,
): AppNavItem[] {
  const starred = new Set(getEffectiveStarredPaths(profile));
  return allStarableNavItems(access).filter((item) => !starred.has(item.to));
}

export function hasUnstarredApps(
  access: AppNavAccess,
  profile: Profile | null | undefined,
): boolean {
  return getExploreGridItems(access, profile).length > 0;
}

/** Star every app the user can access (replaces implicit defaults with an explicit list). */
export function starAllAccessibleAppPaths(access: AppNavAccess): string[] {
  return allStarableNavItems(access).map((item) => item.to);
}

export function getHomeTrailingApps(
  access: AppNavAccess,
  profile: Profile | null | undefined,
): AppNavItem[] {
  const trailing: AppNavItem[] = [];
  if (hasUnstarredApps(access, profile)) {
    trailing.push({ ...EXPLORE_APP, label: "Explore Apps" });
  }
  trailing.push({ ...PROFILE, label: "My Profile" }, FRIENDS_HOME_APP, ABOUT);
  return trailing;
}

export function getHomeGridItems(
  access: AppNavAccess,
  profile: Profile | null | undefined,
): AppNavItem[] {
  const starred = new Set(getEffectiveStarredPaths(profile));
  const starredItems = allStarableNavItems(access).filter((item) =>
    starred.has(item.to),
  );
  return [...starredItems, ...getHomeTrailingApps(access, profile)];
}

/** Onboarding step 7: default-starred apps first, then the rest in category order. */
export function getOnboardingStarableApps(access: AppNavAccess): AppNavItem[] {
  const all = allStarableNavItems(access).filter(
    (item) => !STAFF_ONLY_GAME_PATHS.has(item.to) || access.isStaff,
  );
  const byPath = new Map(all.map((item) => [item.to, item]));
  const defaults = DEFAULT_STARRED_APP_PATHS.map((path) => byPath.get(path)).filter(
    (item): item is AppNavItem => item != null,
  );
  const defaultSet = new Set<string>(DEFAULT_STARRED_APP_PATHS);
  const rest = all.filter((item) => !defaultSet.has(item.to));
  return [...defaults, ...rest];
}

export function profileHasUploadedAvatar(profile: Profile | null | undefined): boolean {
  return Boolean((profile?.avatar_image_key ?? "").trim());
}
