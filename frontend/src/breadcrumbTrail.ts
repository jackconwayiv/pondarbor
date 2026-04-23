/**
 * Breadcrumb items for the current path. The last item is the current page (no `to`).
 * Returns null on the home index — no bar there.
 */
export type BreadcrumbItem = { label: string; to?: string };

const HOME: BreadcrumbItem = { label: "Home", to: "/" };
const GAMES: BreadcrumbItem = { label: "Games", to: "/games" };

function normalizePathname(pathname: string): string {
  const raw = (pathname || "/").split("?")[0] || "/";
  if (raw.length > 1 && raw.endsWith("/")) {
    return raw.slice(0, -1) || "/";
  }
  return raw;
}

/**
 * Breadcrumb trail for a pathname (query string ignored). Null when no bar
 * (home index). Last item is always the current page (no `to`).
 */
export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] | null {
  const p = normalizePathname(pathname);
  if (p === "/") {
    return null;
  }

  if (p === "/games") {
    return [HOME, { label: "Games" }];
  }

  if (p === "/create") {
    return [HOME, { label: "QFF", to: "/qff" }, { label: "Create" }];
  }

  if (p.startsWith("/whatif")) {
    if (p === "/whatif") {
      return [HOME, { ...GAMES }, { label: "WhatIf" }];
    }
    if (p === "/whatif/admin") {
      return [
        HOME,
        { ...GAMES },
        { label: "WhatIf", to: "/whatif" },
        { label: "Admin" },
      ];
    }
    const lobby = p.match(/^\/whatif\/lobby\/(.+)$/);
    if (lobby) {
      return [
        HOME,
        { ...GAMES },
        { label: "WhatIf", to: "/whatif" },
        { label: "Lobby" },
      ];
    }
    if (p.match(/^\/whatif\/play\//)) {
      return [
        HOME,
        { ...GAMES },
        { label: "WhatIf", to: "/whatif" },
        { label: "Play" },
      ];
    }
    if (p.match(/^\/whatif\/hand\//)) {
      return [
        HOME,
        { ...GAMES },
        { label: "WhatIf", to: "/whatif" },
        { label: "Hand" },
      ];
    }
    return [HOME, { ...GAMES }, { label: "WhatIf" }];
  }

  if (p.startsWith("/meal")) {
    return [HOME, { label: "Meal Maestro" }];
  }

  if (p.startsWith("/songaday")) {
    if (p === "/songaday") {
      return [HOME, { label: "Song-a-Day" }];
    }
    if (p === "/songaday/archive") {
      return [
        HOME,
        { label: "Song-a-Day", to: "/songaday" },
        { label: "Archive" },
      ];
    }
    if (p.startsWith("/songaday/entries/")) {
      return [
        HOME,
        { label: "Song-a-Day", to: "/songaday" },
        { label: "Entry" },
      ];
    }
    return [HOME, { label: "Song-a-Day" }];
  }

  if (p === "/calendar") {
    return [HOME, { label: "Calendar" }];
  }
  if (p.startsWith("/calendar/day/")) {
    return [
      HOME,
      { label: "Calendar", to: "/calendar" },
      { label: "Day" },
    ];
  }

  if (p === "/closet") {
    return [HOME, { label: "Community Closet" }];
  }
  if (p.startsWith("/closet/items/")) {
    return [
      HOME,
      { label: "Community Closet", to: "/closet" },
      { label: "Item" },
    ];
  }

  if (p === "/about") {
    return [HOME, { label: "About" }];
  }
  if (p === "/about/privacy") {
    return [HOME, { label: "About", to: "/about" }, { label: "Privacy" }];
  }
  if (p === "/about/terms") {
    return [HOME, { label: "About", to: "/about" }, { label: "Terms" }];
  }

  if (p === "/quotes" || p.startsWith("/quotes/")) {
    if (p === "/quotes" || p === "/quotes/public") {
      return [HOME, { label: "Quotes" }];
    }
    return [HOME, { label: "Quotes" }];
  }

  if (p === "/profile") {
    return [HOME, { label: "Profile" }];
  }
  if (p === "/staff") {
    return [HOME, { label: "Staff" }];
  }
  if (p === "/friends") {
    return [HOME, { label: "Friends" }];
  }

  if (p.match(/^\/friend\/[^/]+$/)) {
    return [
      HOME,
      { label: "Friends", to: "/friends" },
      { label: "Profile" },
    ];
  }
  if (p.includes("/public-quotes")) {
    return [
      HOME,
      { label: "Quotes", to: "/quotes" },
      { label: "Profile" },
    ];
  }

  return [HOME, { label: "Not found" }];
}
