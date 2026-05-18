import type { WhatIfSessionState } from "./types";

export const WHATIF_LOBBY_STATUSES = ["open", "pre_lobby"] as const;

export const WHATIF_IN_PROGRESS_STATUSES = [
  "turn",
  "voting",
  "reveal",
  "post_results",
] as const;

export type WhatIfLobbyStatus = (typeof WHATIF_LOBBY_STATUSES)[number];
export type WhatIfInProgressStatus = (typeof WHATIF_IN_PROGRESS_STATUSES)[number];

export function isWhatIfLobbyStatus(
  status: WhatIfSessionState["status"] | string,
): boolean {
  return (WHATIF_LOBBY_STATUSES as readonly string[]).includes(status);
}

export function isWhatIfInProgressStatus(
  status: WhatIfSessionState["status"] | string,
): boolean {
  return (WHATIF_IN_PROGRESS_STATUSES as readonly string[]).includes(status);
}
