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

const MEAL: AppNavItem = {
  to: "/meal",
  /** Matches `MealLayout` h1. */
  emoji: "🧑‍🍳",
  label: "Meal Maestro",
  navLabel: "Meals",
  blurb: "Meal plans and recipes.",
};

const FRIENDS: AppNavItem = {
  to: "/profile?tab=friends",
  /** Friends tab on Profile. */
  emoji: "👥",
  label: "Friends",
  blurb: "Find and browse your friends.",
};

/** Home app grid order (games rendered as a separate section on home). */
export const APP_HOME_APPS: AppNavItem[] = [SONGADAY, CALENDAR, CLOSET, QUOTES, MEAL, FRIENDS, ABOUT];

/** Top bar + hamburger order mirrors home icons, with Games inserted before About. */
export const APP_DESKTOP_NAV: AppNavItem[] = [
  SONGADAY,
  CALENDAR,
  CLOSET,
  QUOTES,
  MEAL,
  FRIENDS,
  GAMES,
  ABOUT,
];

export function guestHamburgerNavItems(): AppNavItem[] {
  return [WHATIF, ABOUT];
}
