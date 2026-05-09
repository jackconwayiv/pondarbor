import { Avatar, Text } from "@chakra-ui/react";

import { useAppSession } from "../auth/AppSessionContext";
import type { WhatIfPlayer } from "./types";
import { resolveWhatIfPlayerAvatarUrl } from "./whatifPlayerAvatar";

type WhatIfPlayerFaceProps = {
  player: WhatIfPlayer;
  /** Hand UI: set to `state.state.you?.id` so your tile uses profile + Google when API omits `avatar_url`. */
  viewerPlayerId?: number | null;
  /** Chakra `Avatar.Root` size when a profile image exists. */
  avatarSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  emojiFontSize?: string;
  flexShrink?: number;
};

export function WhatIfPlayerFace({
  player,
  viewerPlayerId = null,
  avatarSize = "md",
  emojiFontSize = "1.25em",
  flexShrink = 0,
}: WhatIfPlayerFaceProps) {
  const { sessionUser, auth0User } = useAppSession();
  const url = resolveWhatIfPlayerAvatarUrl(player, {
    viewerPlayerId,
    sessionUser,
    auth0User,
  });
  if (url) {
    return (
      <Avatar.Root size={avatarSize} flexShrink={flexShrink}>
        <Avatar.Image src={url} alt="" />
        <Avatar.Fallback name={player.display_name}>{player.avatar_emoji}</Avatar.Fallback>
      </Avatar.Root>
    );
  }
  return (
    <Text as="span" fontSize={emojiFontSize} lineHeight="1" flexShrink={flexShrink}>
      {player.avatar_emoji}
    </Text>
  );
}
