import { Avatar, Text } from "@chakra-ui/react";

import type { WhatIfPlayer } from "./types";

export function whatifPlayerAvatarUrl(p: { avatar_url?: string | null }): string {
  return (p.avatar_url ?? "").trim();
}

type WhatIfPlayerFaceProps = {
  player: WhatIfPlayer;
  /** Chakra `Avatar.Root` size when a profile image exists. */
  avatarSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  emojiFontSize?: string;
  flexShrink?: number;
};

export function WhatIfPlayerFace({
  player,
  avatarSize = "md",
  emojiFontSize = "1.25em",
  flexShrink = 0,
}: WhatIfPlayerFaceProps) {
  const url = whatifPlayerAvatarUrl(player);
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
