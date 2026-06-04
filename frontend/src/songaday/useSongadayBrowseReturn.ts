import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

export type SongadayBrowseNavState = {
  returnPath: string;
  /** Opens playlist panel in archive area on `/songaday`. */
  openSongadayArchive?: boolean;
  /** @deprecated Use openSongadayArchive */
  openBrowsePlaylists?: boolean;
};

/** After month player Back: expand archive collapsible on main Song-a-Day page. */
export function useOpenSongadayArchiveFromNav(setArchiveOpen: (open: boolean) => void): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const st = location.state as SongadayBrowseNavState | null;
    if (!st?.openSongadayArchive && !st?.openBrowsePlaylists) return;
    if (location.pathname !== "/songaday") return;
    setArchiveOpen(true);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: {} },
    );
  }, [location.pathname, location.search, location.state, navigate, setArchiveOpen]);
}
