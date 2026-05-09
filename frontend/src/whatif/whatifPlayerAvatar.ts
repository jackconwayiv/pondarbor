import type { User } from "@auth0/auth0-react";

import {
  resolveCurrentUserAvatarUrl,
  type SessionUser,
} from "../auth/AppSessionContext";
import type { WhatIfPlayer } from "./types";

/** Raw image URL from session payload (Pond profile); may be empty when cleared. */
export function rawWhatIfPlayerAvatarUrl(
  p: Pick<WhatIfPlayer, "avatar_url">,
): string {
  return (p.avatar_url ?? "").trim();
}

/**
 * Resolved image URL for a WhatIf seat/player tile.
 *
 * - Everyone else: API `avatar_url` only (guests / TV have no Google photo client-side).
 * - **Your** player row (`player.id === viewerPlayerId`): same chain as the rest of the app —
 *   Pond profile avatar, then Auth0/Google picture, then API URL (server copy).
 *
 * Pass `viewerPlayerId` from hand state `state.state.you?.id` (phone). TV/play may omit it.
 */
export function resolveWhatIfPlayerAvatarUrl(
  player: Pick<WhatIfPlayer, "id" | "avatar_url">,
  opts: {
    viewerPlayerId?: number | null;
    sessionUser: SessionUser | null | undefined;
    auth0User: User | null | undefined;
  },
): string {
  const base = rawWhatIfPlayerAvatarUrl(player);
  const vid = opts.viewerPlayerId;
  if (vid != null && player.id === vid) {
    return (
      resolveCurrentUserAvatarUrl(opts.sessionUser, opts.auth0User) || base
    );
  }
  return base;
}

/**
 * Join-screen preview (no `WhatIfPlayer` row yet). Same URL priority as your in-game tile when the API omits `avatar_url`:
 * Pond profile → Auth0/Google picture.
 */
export function resolveWhatIfViewerFallbackAvatarUrl(
  sessionUser: SessionUser | null | undefined,
  auth0User: User | null | undefined,
): string {
  return resolveCurrentUserAvatarUrl(sessionUser, auth0User);
}
