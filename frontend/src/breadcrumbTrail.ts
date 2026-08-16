/**
 * Breadcrumb items for the current path. The last item is the current page (no `to`).
 * Returns null only when a route should not render breadcrumbs.
 */
export type BreadcrumbItem = { label: string; to?: string };

const HOME: BreadcrumbItem = { label: "Home", to: "/" };

function normalizePathname(pathname: string): string {
  const raw = (pathname || "/").split("?")[0] || "/";
  if (raw.length > 1 && raw.endsWith("/")) {
    return raw.slice(0, -1) || "/";
  }
  return raw;
}

/**
 * Breadcrumb trail for a path. `search` is used for a few multi-surface
 * routes (e.g. Profile tabs). Null when no bar. Last item is
 * always the current page (no `to`).
 */
export function getBreadcrumbItems(
  pathname: string,
  search: string = "",
): BreadcrumbItem[] | null {
  const p = normalizePathname(pathname);
  const sp = new URLSearchParams(search || "");
  if (p === "/") {
    return [{ label: "Home" }];
  }

  if (p === "/explore") {
    return [HOME, { label: "Explore" }];
  }

  if (p === "/activity") {
    return [HOME, { label: "Notifications" }];
  }

  if (p === "/clicker") {
    return [HOME, { label: "PondClicker" }];
  }
  if (p.startsWith("/clicker/")) {
    if (p === "/clicker/2") {
      return [
        HOME,
        { label: "PondClicker", to: "/clicker" },
        { label: "Redux" },
      ];
    }
    return [HOME, { label: "PondClicker" }];
  }
  if (p.startsWith("/estates/play/")) {
    return null;
  }
  if (p === "/estates" || p.startsWith("/estates/")) {
    return [HOME, { label: "Estates" }];
  }

  if (p === "/squalls") {
    return [HOME, { label: "Squalls & Shanties" }];
  }
  if (p === "/squalls/play") {
    return [
      HOME,
      { label: "Squalls & Shanties", to: "/squalls" },
      { label: "Playing" },
    ];
  }
  if (p === "/squalls/dm") {
    return [
      HOME,
      { label: "Squalls & Shanties", to: "/squalls" },
      { label: "DM Reference" },
    ];
  }

  if (p === "/create") {
    return [HOME, { label: "QFF", to: "/qff" }, { label: "Create" }];
  }

  if (p.startsWith("/whatif")) {
    if (p === "/whatif") {
      return [HOME, { label: "WhatIf" }];
    }
    if (p === "/whatif/admin") {
      return [
        HOME,
        { label: "WhatIf", to: "/whatif" },
        { label: "Admin" },
      ];
    }
    const lobby = p.match(/^\/whatif\/lobby\/(.+)$/);
    if (lobby) {
      return [
        HOME,
        { label: "WhatIf", to: "/whatif" },
        { label: "Lobby" },
      ];
    }
    return [HOME, { label: "WhatIf" }];
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
    const monthMatch = /^\/songaday\/month\/(\d{4})\/(\d{1,2})$/.exec(p);
    if (monthMatch) {
      return [
        HOME,
        { label: "Song-a-Day", to: "/songaday" },
        { label: "Month" },
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

  if (p === "/people") {
    return [HOME, { label: "Family Tree" }];
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

  if (p === "/recommendations" || p.startsWith("/recommendations/")) {
    if (p === "/recommendations") {
      return [HOME, { label: "Recommenda" }];
    }
    const parts = p.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "recommendations") {
      const slug = parts[1];
      if (parts.length === 2) {
        return [
          HOME,
          { label: "Recommenda", to: "/recommendations" },
          { label: slug.replace(/-/g, " ") },
        ];
      }
      if (parts[2] === "new") {
        return [
          HOME,
          { label: "Recommenda", to: "/recommendations" },
          { label: "New" },
        ];
      }
    }
    return [HOME, { label: "Recommenda" }];
  }

  if (p === "/goals" || p.startsWith("/goals/")) {
    return [HOME, { label: "Goal-Getter" }];
  }

  if (p === "/books" || p.startsWith("/books/")) {
    return [HOME, { label: "Books" }];
  }

  if (p === "/achievements" || p.startsWith("/achievements/")) {
    return [HOME, { label: "Hall of Fame" }];
  }

  if (p.startsWith("/scorenado")) {
    const scorenado = { label: "Scorenado", to: "/scorenado" };
    if (p === "/scorenado") {
      return [HOME, { label: "Scorenado" }];
    }
    if (p === "/scorenado/templates") {
      return [HOME, scorenado, { label: "Templates" }];
    }
    if (p === "/scorenado/history") {
      return [HOME, scorenado, { label: "History" }];
    }
    if (/^\/scorenado\/game\/[^/]+$/.test(p)) {
      return [HOME, scorenado, { label: "Scoreboard" }];
    }
    return [HOME, { label: "Scorenado" }];
  }

  if (p === "/profile") {
    if (sp.get("tab") === "friends") {
      return [HOME, { label: "Profile", to: "/profile" }, { label: "Friends" }];
    }
    if (sp.get("tab") === "account") {
      return [HOME, { label: "Profile", to: "/profile" }, { label: "Account" }];
    }
    return [HOME, { label: "Profile" }];
  }
  if (p === "/staff") {
    return [HOME, { label: "Staff" }];
  }
  if (p === "/staff/zodiac") {
    return [
      HOME,
      { label: "Staff", to: "/staff" },
      { label: "Zodiackary import" },
    ];
  }
  if (p === "/zodiac/staff") {
    return [
      HOME,
      { label: "Staff", to: "/staff" },
      { label: "Zodiackary import" },
    ];
  }

  if (p === "/zodiac") {
    return [HOME, { label: "Zodiackary" }];
  }
  if (p.match(/^\/friend\/[^/]+$/)) {
    return [
      HOME,
      { label: "Friends", to: "/profile?tab=friends" },
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

  if (p === "/pondstead" || p.startsWith("/pondstead/")) {
    return [HOME, { label: "Pondstead", to: "/pondstead" }];
  }

  return [HOME, { label: "Not found" }];
}
