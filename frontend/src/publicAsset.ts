/** Vite dev: `public/` is served at `/`. Django+collectstatic: URL comes from the HTML shell. */
export function pondarborLogoSrc(): string {
  if (import.meta.env.DEV) {
    return "/pondarborlogo.png";
  }
  const fromShell = document.documentElement.dataset.pondarborLogo;
  return fromShell && fromShell.length > 0
    ? fromShell
    : "/static/pondarborlogo.png";
}

export function pondarborProfileSrc(): string {
  if (import.meta.env.DEV) {
    return "/pondarborprofile.png";
  }
  const fromShell = document.documentElement.dataset.pondarborProfile;
  return fromShell && fromShell.length > 0
    ? fromShell
    : "/static/pondarborprofile.png";
}
