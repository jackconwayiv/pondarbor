/**
 * App navigation metadata: shared by the home page and the app shell (desktop + hamburger).
 */
export type AppNavItem = {
  to: string;
  emoji: string;
  /** Full name (home list, hamburger, tooltips). */
  label: string;
  /** Shorter name for the desktop top bar; defaults to `label`. */
  navLabel?: string;
  blurb: string;
};

export function navLinkLabel(item: AppNavItem): string {
  return item.navLabel ?? item.label;
}

/** Desktop header: app link label colors (navy bar). */
export const NAV_HEADER_LINK_TEXT = {
  active: "white",
  inactive: "rgba(245, 241, 232, 0.75)",
} as const;

const GAMES: AppNavItem = {
  to: "/games",
  /** Games hub. */
  emoji: "🕹️",
  label: "Games",
  blurb: "PondClicker, WhatIf, and more.",
};

const WHATIF: AppNavItem = {
  to: "/whatif",
  emoji: "🎲",
  label: "WhatIf",
  blurb: "Party game you can try without an account.",
};

const ABOUT: AppNavItem = {
  to: "/about",
  /** Matches `AboutPage` h1. */
  emoji: "🐢",
  label: "About",
  blurb: "Project info, terms, and privacy.",
};

const SONGADAY: AppNavItem = {
  to: "/songaday",
  /** Matches `SongadayLayout` h1 (“Song-a-Day Challenge”). */
  emoji: "🎶",
  label: "Song-a-Day",
  blurb: "Daily music prompts and friends' picks.",
};

const CALENDAR: AppNavItem = {
  to: "/calendar",
  /** Matches `CalendarPage` h1. */
  emoji: "🗓️",
  label: "Calendar",
  blurb: "See when friends are out or busy.",
};

const CLOSET: AppNavItem = {
  to: "/closet",
  /** Matches `ClosetPage` h1. */
  emoji: "👒",
  label: "Community Closet",
  navLabel: "Closet",
  blurb: "Lend and borrow items with friends.",
};

const QUOTES: AppNavItem = {
  to: "/quotes",
  /** Matches `QuotesFeedPage` h1 (“Quotes Archive”). */
  emoji: "📜",
  label: "Quotes",
  blurb: "Archive of user-recorded quotes.",
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
  label: "Zodiac",
  blurb: "Zodiackary natal chart (staff-imported).",
};

const MEAL: AppNavItem = {
  to: "/meal",
  /** Matches `MealLayout` h1. */
  emoji: "🧑‍🍳",
  label: "Meal Maestro",
  navLabel: "Meals",
  blurb: "Meal plans and recipes.",
};

const FAMILY_TREE: AppNavItem = {
  to: "/people",
  emoji: "🌳",
  label: "Family Tree",
  blurb: "Your people and how they relate to you.",
};

const PROFILE: AppNavItem = {
  to: "/profile",
  /** Matches `ProfilePage` h1 default tab. */
  emoji: "👤",
  label: "Profile",
  blurb: "Your profile and account settings.",
};

/** Home app grid order (individual games appended on home for signed-in users). */
export const APP_HOME_APPS: AppNavItem[] = [
  SONGADAY,
  CALENDAR,
  PROFILE,
  CLOSET,
  QUOTES,
  GOALS_APP,
  ZODIAC,
  FAMILY_TREE,
  MEAL,
  ABOUT,
];

/** Top bar + hamburger order (Games hub; no Profile — account menu only). */
export const APP_DESKTOP_NAV: AppNavItem[] = [
  SONGADAY,
  CALENDAR,
  CLOSET,
  QUOTES,
  GOALS_APP,
  ZODIAC,
  FAMILY_TREE,
  MEAL,
  GAMES,
  ABOUT,
];

export function guestHamburgerNavItems(): AppNavItem[] {
  return [WHATIF, ABOUT];
}
